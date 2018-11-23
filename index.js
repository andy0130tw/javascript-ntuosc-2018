const Koa = require('koa')
const Router = require('koa-router')
const cors = require('@koa/cors')
const bodyParser = require('koa-bodyparser')

const app = new Koa()
const router = new Router()

const TIMEOUT_AFTER = 30000
let users = {}
let messageHistory = []

// app.use(async ctx => {
//   ctx.body = 'Hello World'
// })

function addMsgToQueue(msg) {
  messageHistory.push(msg)
  Object.entries(users).forEach(pair => {
    let token = pair[0]
    let user = pair[1]

    if (user.emitter)
      user.emitter(msg)
  })
}

function createPollForUser(user) {
  return new Promise((resolve, reject) => {
    user.emitter = resolve
  })
}

/*
 * Middlewares
 */

let corsMiddleware = cors()


function authenticateMiddleware(ctx, next) {
  let token = ctx.request.query.token

  if (!token) {
    throw new Error('No token given')
  }

  if (!users[token]) {
    throw new Error('Invalid token')
  }

  // save the user's reference for later use
  ctx.user = users[token]
  return next()
}

/*
 * Routes
 */

// Default error handling route
router.use(async (ctx, next) => {
  return next()
    .catch(err => {
      console.log('Request errored:', err.message)
      ctx.body = { ok: false, err: `Error: ${err.message}` }
    })

  // await style:
  /*
  try {
    await next()
  } catch(err) {
    console.log('Request errored:', err.message)
    ctx.body = { ok: false, err: `Error: ${err.message}` }
  }
  */
})

router.get('/', ctx => {
  ctx.body = `Hello world`
})

router.post('/join',
  corsMiddleware,
  ctx => {
  let username = ctx.request.body.name
  username = username != null ? username.trim() : ''

  if (!username) {
    ctx.body = { ok: false, msg: 'empty username' }
    return
  }

  let token = Math.floor(Math.random() * 1e10).toString()
  users[token] = {
    name: username
  }

  console.log(`User ${username} (${token}) joined`)

  ctx.body = {
    ok: true,
    name: username,
    token: token
  }
})

router.get('/poll',
  corsMiddleware,
  authenticateMiddleware,
  ctx => {
  return new Promise((resolve, reject) => {
    let poll = createPollForUser(ctx.user)

    // timeout, send empty response
    let t = setTimeout(() => {
      // discard the polling promise
      ctx.user.emitter = null
      ctx.body = []
      resolve()
    }, TIMEOUT_AFTER)

    // if the poll is resolved, clear the timeout
    ctx.user.poll.then(arrMsg => {
      ctx.user.emitter = null
      ctx.body = arrMsg
      clearTimeout(t)
      resolve()
    })

  })
})

router.get('/getLatest',
  corsMiddleware,
  authenticateMiddleware,
  ctx => {
    ctx.body = {
      ok: true,
      history: messageHistory
    }
})

router.post('/chat',
  corsMiddleware,
  authenticateMiddleware,
  ctx => {
    addMsgToQueue({
      name: ctx.user.name,
      message: ctx.request.body.message
    })
    ctx.body = {
      ok: true
    }
})

app.use(bodyParser())
   .use(router.routes())
   .use(router.allowedMethods())

app.listen(3000)
