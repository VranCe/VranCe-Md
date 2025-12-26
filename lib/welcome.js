const { generateWAMessageFromContent, generateWAMessage, prepareWAMessageMedia, downloadContentFromMessage, proto, delay } = require('baileys')
const fs = require('fs')
const axios = require('axios')
const path = require('path')
const chalk = require('chalk')
require('../settings')

module.exports.welcome = async (iswel, isleft, VranCe, anu) => {
  try {
    const metadata = await VranCe.groupMetadata(anu.id)
    const participants = anu.participants
    const num = participants[0]
    const groupName = metadata.subject
    const groupDesc = metadata.desc
    const memeg = metadata.participants.length

    const isWelcomeEnabled = global.db.data.chats[anu.id]?.welcome
    const isLeftEnabled = global.db.data.chats[anu.id]?.goodbye
    const mentionedJid = [`${num}@s.whatsapp.net`]

    let avatarUrl, ppgroup

    try {
      avatarUrl = await VranCe.profilePictureUrl(num, 'image')
    } catch {
      avatarUrl = 'https://telegra.ph/file/750ed3947ea3722c20b77.png'
    }

    try {
      ppgroup = await VranCe.profilePictureUrl(anu.id, 'image')
    } catch {
      ppgroup = 'https://telegra.ph/file/c3f3d2c2548cbefef1604.jpg'
    }

    if (anu.action == 'add' && (iswel || isWelcomeEnabled)) {
      let full_pesan
      if (global.db.data.chats[anu.id]?.text_welcome) {
        let teks = global.db.data.chats[anu.id].text_welcome
        full_pesan = teks
          .replace(/@user/gi, `@${num.split('@')[0]}`)
          .replace(/@group/gi, groupName)
          .replace(/@desc/gi, groupDesc || '')
      } else {
        full_pesan = `Welcome @${num.split('@')[0]}\nTo Group: ${groupName}`
      }

      await VranCe.sendMessage(anu.id, {
        text: full_pesan,
        contextInfo: {
          mentionedJid,
          externalAdReply: {
            title: `☘️ Halo Selamat Datang!`,
            body: `${botname}`,
            thumbnailUrl: ppgroup,
            sourceUrl: "https://whatsapp.com/channel/0029ValMMHmC1Fu0C",
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      })
    }

    if (anu.action == 'remove' && (isleft || isLeftEnabled)) {
      let full_pesan
      if (global.db.data.chats[anu.id]?.text_left) {
        let teks = global.db.data.chats[anu.id].text_left
        full_pesan = teks
          .replace(/@user/gi, `@${num.split('@')[0]}`)
          .replace(/@group/gi, groupName)
          .replace(/@desc/gi, groupDesc || '')
      } else {
        full_pesan = `Goodbye @${num.split('@')[0]}\nFrom Group: ${groupName}`
      }

      await VranCe.sendMessage(anu.id, {
        text: full_pesan,
        contextInfo: {
          mentionedJid,
          externalAdReply: {
            title: `☘️ GoodBye Selamat Tinggal!`,
            body: `${botname}`,
            thumbnailUrl: ppgroup,
            sourceUrl: "https://whatsapp.com/channel/0029ValMMHmC1Fu0C",
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      })
    }
  } catch (err) {
    console.error('Error welcome handler:', err)
  }
}

let file = require.resolve(__filename)
fs.watchFile(file, () => {
  fs.unwatchFile(file)
  console.log(chalk.greenBright(`Update File => ${__filename}`))
  delete require.cache[file]
  require(file)
})