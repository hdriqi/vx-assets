const NATS = require('nats')

class Worker {
  constructor(ctl) {
    this.nc = null
    this.ctl = ctl
  }

  async init() {
    this.nc = await NATS.connect({ 
      url: process.env.NATS_URL,
      json: true,
      maxReconnectAttempts: -1, 
      reconnectTimeWait: 250
    })
  }

  async authVerifyClient(payload) {
    return new Promise((resolve, reject) => {
      if(!this.nc) {
        reject({
          status: 'error',
          message: `worker has not been init`
        })
      }
      this.nc.request('auth.verify.client', {
        clientId: payload.clientId,
        clientSecret: payload.clientSecret
      }, { max: 1, timeout: 2500 }, (msg) => {
        resolve(msg)
      })
    })
  }

  async authVerifyToken(payload) {
    return new Promise((resolve, reject) => {
      if(!this.nc) {
        reject({
          status: 'error',
          message: `worker has not been init`
        })
      }
      this.nc.request('auth.verify.token', {
        accessToken: payload.accessToken,
      }, { max: 1, timeout: 2500 }, (msg) => {
        resolve(msg)
      })
    })
  }
}

module.exports = Worker