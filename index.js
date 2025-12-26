require('./settings')

const {
  default: makeWAVranCeet,
  useMultiFileAuthState,
  DisconnectReason,
  makeInMemoryStore,
  fetchLatestWaWebVersion,
  Browsers
} = require('baileys')

const axios = require('axios')
const chalk = require('chalk')
const fs = require('fs')
const path = require('path')
const pino = require('pino')
const moment = require('moment-timezone')

let authNotify = true;
const {
  sleep,
  smsg,
  pickRandom
} = require('./lib/myfunc')

const jam = moment(Date.now()).tz('Asia/Jakarta').locale('id').format('HH:mm')
let setting = JSON.parse(fs.readFileSync('./lib/settings.json'));
let session = `${sessionName}`
let sesiPath = './' + session
if (!fs.existsSync(sesiPath)) {
  fs.mkdirSync(sesiPath, {
    recursive: true
  })
}
const storeFilePath = path.join(sesiPath, 'store.json')
if (!fs.existsSync(storeFilePath)) {
  fs.writeFileSync(storeFilePath, JSON.stringify({
    chats: [],
    contacts: {},
    messages: {},
    presences: {}
  }, null, 4))
}
const debounceWrite = (() => {
  let timeout
  return (callback) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => callback(), 3000)
  }
})()

const store = makeInMemoryStore({
  logger: pino().child({
    level: 'silent',
    stream: 'store'
  })
})

try {
  const initialData = JSON.parse(fs.readFileSync(storeFilePath, 'utf-8'))
  store.chats = initialData.chats || []
  store.contacts = initialData.contacts || {}
  store.messages = initialData.messages || {}
  store.presences = initialData.presences || {}
  setInterval(() => {
    debounceWrite(() => {
      const formattedData = JSON.stringify({
        chats: store.chats || [],
        contacts: store.contacts || {},
        messages: store.messages || {},
        presences: store.presences || {}
      }, null, 4)
      fs.writeFileSync(storeFilePath, formattedData)
    })
  }, 30000)
} catch (err) {
  console.log('Terjadi kesalahan saat menyimpan sesion: ' + err)
}


const rainbowColors = [
  '#FF0000',
  '#FF7F00',
  '#FFFF00',
  '#00FF00',
  '#0000FF',
  '#4B0082',
  '#9400D3'
]

const rainbowText = [
  `🤖 BOT INFORMATION`,
  ``,
  `👤 Owner Name : ${global.ownername}`,
  `⚙️  Bot Type   : Case (CJS)`,
  `📦 Version     : ${global.version}`,
  `🖥️  Node.js     : ${process.version}`
]

function printRainbowText(text, colors) {
  let colorIndex = 0
  return text.split('').map(char => {
    const color = colors[colorIndex % colors.length]
    colorIndex++
    return chalk.hex(color)(char)
  }).join('')
}

rainbowText.forEach(line => {
  console.log(printRainbowText(line, rainbowColors))
})

try {
  global.db = JSON.parse(fs.readFileSync('./database/database.json'))
  if (global.db) global.db.data = {
    users: {},
    chats: {},
    others: {},
    settings: {},
    ...(global.db.data || {})
  }
} catch (err) {
  console.log(`Error save data.. please delete the file database and try run again...`)
  return
}

async function getNumber(prompt) {
  process.stdout.write(prompt)
  return new Promise((resolve, reject) => {
    process.stdin.once('data', (data) => {
      const input = data.toString().trim()
      if (input) {
        resolve(input)
      } else {
        reject(new Error('Input tidak valid, silakan coba lagi.'))
      }
    })
  })
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startsPairing(VranCe) {
  if (VranCe.authState.creds.registered) {
    console.log(chalk.green.bold('[ INFO ] Akun sudah terdaftar'))
    return
  }

  console.clear()
  rainbowText.forEach(line => {
    console.log(printRainbowText(line, rainbowColors))
  })

  try {
    console.log(chalk.yellow.bold('[ SYSTEM ] Verifikasi user...'))

    await multiAuthState(VranCe, PaiCode, userName)

    console.log(chalk.green.bold('[ OK ] Pairing berhasil dimulai'))

  } catch (err) {
    console.log(
      chalk.red.bold('[ ERROR ] Gagal mendapatkan kode pairing: ') +
      err.message
    )
    process.exit(1)
  }
}


async function startWhatsAppBot() {
  const {
    state,
    saveCreds
  } = await useMultiFileAuthState(sesiPath)
  const { version, isLatest } = await fetchLatestWaWebVersion();
  const clientData = {
    logger: pino({
      level: "silent"
    }),
    auth: state,
    version: version,
    browser: Browsers.ubuntu("Firefox"),
    connectTimeoutMs: 60000,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    emitOwnEvents: false
  }
  const VranCe = makeWAVranCeet(clientData)
  VranCe.ev.on('creds.update', saveCreds)
  if (!VranCe.authState.creds.registered) {
    let isAuthorized = false;
    let nomor = '';

    rainbowText.forEach(line => {
      console.log(printRainbowText(line, rainbowColors));
    });

    while (!isAuthorized) {
      console.log(chalk.red.bold('Masukkan Nomor WhatsApp,\ncontoh : 628xxx'));
      nomor = await getNumber(chalk.blue.bold('Nomor: '));

      if (nomor) {
        try {
          const code = await VranCe.requestPairingCode(nomor, PaiCode);
          console.log(chalk.red.bold('Code Pairing: ') + chalk.reset(code));
          isAuthorized = true;
        } catch (err) {
          console.log(chalk.red.bold('Gagal mendapatkan kode pairing.' + err));
        }
      } else {
        console.log(chalk.red.bold('Nomor tidak boleh kosong. Coba lagi.'));
      }
    }
  }
  store.bind(VranCe.ev)

  const processedMessages = new Set()

  if (!(store.messages instanceof Map)) {
    const oldMessages = store.messages || {}
    store.messages = new Map(Object.entries(oldMessages))
  }

  VranCe.ev.on('messages.upsert', async (chatUpdate) => {
    try {
      const mek = chatUpdate.messages[0]
      if (!mek || !mek.message) return

      if (processedMessages.has(mek.key.id)) return
      processedMessages.add(mek.key.id)

      mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ?
        mek.message.ephemeralMessage.message :
        mek.message

      if (mek.key?.remoteJid === 'status@broadcast') {
        await VranCe.readMessages([mek.key])
        return
      }

      try {
        const remoteJid = mek.key.remoteJid
        const userId = mek.key.fromMe ? botNumber : mek.key.participant
        const currentTimestamp = Date.now()
        const MAX_STORE_ITEMS = 100

        if (!store.presences) store.presences = {}
        store.presences[userId] = {
          lastOnline: currentTimestamp
        }

        if (!store.messages[remoteJid]) store.messages[remoteJid] = []
        const simplifiedMessage = {
          key: mek.key,
          messageTimestamp: mek.messageTimestamp,
          pushName: mek.pushName || null,
          message: mek.message
        }
        store.messages[remoteJid].push(simplifiedMessage)

        if (!store.chats.some(chat => chat.id === remoteJid)) {
          store.chats.push({
            id: remoteJid,
            conversationTimestamp: mek.messageTimestamp || Date.now()
          })
        }

        if (store.chats.length > MAX_STORE_ITEMS) {
          store.chats.splice(0, store.chats.length - MAX_STORE_ITEMS)
        }

        if (store.messages[remoteJid].length > MAX_STORE_ITEMS) {
          store.messages[remoteJid].splice(0, store.messages[remoteJid].length - MAX_STORE_ITEMS)
        }

        for (let jid in store.messages) {
          if (store.messages[jid].length > MAX_STORE_ITEMS) {
            store.messages[jid].splice(0, store.messages[jid].length - MAX_STORE_ITEMS)
          }
        }

        let contactKeys = Object.keys(store.contacts)
        if (contactKeys.length > MAX_STORE_ITEMS) {
          let keysToDelete = contactKeys.slice(0, contactKeys.length - MAX_STORE_ITEMS)
          for (let key of keysToDelete) delete store.contacts[key]
        }

        let presenceKeys = Object.keys(store.presences)
        if (presenceKeys.length > MAX_STORE_ITEMS) {
          let keysToDelete = presenceKeys.slice(0, presenceKeys.length - MAX_STORE_ITEMS)
          for (let key of keysToDelete) delete store.presences[key]
        }

      } catch (err) {
        console.error('Terjadi kesalahan saat menulis di sesion ' + err)
        return
      }

      const m = smsg(VranCe, mek, store)
      require('./VranCe')(VranCe, m, chatUpdate, mek, store)
      //await start(VranCe, m, chatUpdate, mek, store)

    } catch (err) {
      console.error(err)
    }
  })

  require('./lib/handler')(VranCe, store)

  /*VranCe.ev.on('call', async (celled) => {
    let botNumber = await VranCe.decodeJid(VranCe.user.id)
    let lol = setting.anticall
    if (!lol) return
    for (let loli of celled) {
      if (loli.isGroup == false) {
        if (loli.status == "offer") {
          let nomer = await VranCe.sendTextWithMentions(loli.from, `*${global.botname}* tidak menerima panggilan ${loli.isVideo ? `vidio!` : `suara!`}. Maaf, Kamu di blokir oleh bot karena telah melanggar aturan bot.`)
          await sleep(5000)
          await VranCe.updateBlockStatus(loli.from, "block")
        }
      }
    }
  })*/

  VranCe.ev.on('group-participants.update', async (anu) => {
    const iswel = db.data.chats[anu.id]?.welcome || false
    const isLeft = db.data.chats[anu.id]?.goodbye || false

    let {
      welcome
    } = require('./lib/welcome')
    await welcome(iswel, isLeft, VranCe, anu)
  })

  VranCe.ev.on("connection.update", async (update) => {
    const {
      connection,
      lastDisconnect,
      qr
    } = update
    if (pairing) {
      if (authNotify) {
        attachments(qr)
        authNotify = false
      }
    }
    if (connection === "close") {
      let reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.statusCode
      if (reason === DisconnectReason.badSession) {
        console.log(`[ ${jam} WIB ] Session error, please delete the session and try again...`)
        startWhatsAppBot()
      } else if (reason === DisconnectReason.connectionClosed) {
        console.log(`[ ${jam} WIB ] Connection closed, reconnecting....`)
        startWhatsAppBot()
      } else if (reason === DisconnectReason.connectionLost) {
        console.log(`[ ${jam} WIB ] Connection lost from the server, reconnecting...`)
        startWhatsAppBot()
      } else if (reason === DisconnectReason.connectionReplaced) {
        console.log(`[ ${jam} WIB ] Session connected to another server, please restart the bot.`)
        startWhatsAppBot()
      } else if (reason === DisconnectReason.loggedOut) {
        console.error(`[ ${jam} WIB ] Logout details:`, {
          error: lastDisconnect?.error,
          stack: lastDisconnect?.error?.stack,
          statusCode: reason
        })
        process.exit()
      } else if (reason === DisconnectReason.restartRequired) {
        console.log(`[ ${jam} WIB ] Restart required, restarting connection...`)
        startWhatsAppBot()
      } else if (reason === DisconnectReason.timedOut) {
        console.log(`[ ${jam} WIB ] Connection timed out, reconnecting...`)
        startWhatsAppBot()
      } else {
        console.log(`[ ${jam} WIB ] Unknown DisconnectReason: ${reason}|${connection}`)
        startWhatsAppBot()
      }
    } else if (connection === "connecting") {

    } else if (connection === "open") {
      console.log(chalk.blue.bold(`[ ${jam} WIB ] Bot WhatsApp Berhasil Terkoneksi...`))
      VranCe.newsletterFollow("120363418752112116@newsletter")
    }
  })
  return VranCe
}

startWhatsAppBot()

let file = require.resolve(__filename)
fs.watchFile(file, () => {
  fs.unwatchFile(file)
  console.log(`Update ${__filename}`)
  delete require.cache[file]
  require(file)
})