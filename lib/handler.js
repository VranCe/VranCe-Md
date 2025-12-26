require('../settings')
const {
  useMultiFileAuthState,
  DisconnectReason,
  generateForwardMessageContent,
  generateWAMessageFromContent,
  fetchLatestBaileysVersion,
  downloadContentFromMessage,
  prepareWAMessageMedia,
  InteractiveMessage,
  utilsFlagHandler,
  jidDecode,
  proto,
  Browsers
} = require('baileys')

const axios = require('axios')
const chalk = require('chalk')
const fs = require('fs')
const FileType = require('file-type')
const path = require('path')
const pino = require('pino')
const PhoneNumber = require('awesome-phonenumber')
const {
  exec,
  execSync
} = require('child_process')
const {
  imageToWebp,
  imageToWebp3,
  videoToWebp,
  writeExifImg,
  writeExifImgAV,
  writeExifVid
} = require('./exif')
const {
  getBuffer,
  sleep,
  smsg
} = require('./myfunc')

async function getHandlerMsg(VranCe, store) {
    // Decode JID function
    VranCe.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {}
            return decode.user && decode.server && decode.user + '@' + decode.server || jid
        } else return jid
    }

    // Contacts update handler
    VranCe.ev.on('contacts.update', update => {
        for (let contact of update) {
            let id = VranCe.decodeJid(contact.id)
            if (store && store.contacts) store.contacts[id] = {
                id,
                name: contact.notify
            }
        }
    })

    // Get name function
    VranCe.getName = (jid, withoutContact = false) => {
        id = VranCe.decodeJid(jid)
        withoutContact = VranCe.withoutContact || withoutContact
        let v
        if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
            v = store.contacts[id] || {}
            if (!(v.name || v.subject)) v = VranCe.groupMetadata(id) || {}
            resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
        })
        else v = id === '0@s.whatsapp.net' ? {
            id,
            name: 'WhatsApp'
        } : id === VranCe.decodeJid(VranCe.user.id) ?
            VranCe.user :
            (store.contacts[id] || {})
        return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
    }

    // Send contact function
    VranCe.sendContact = async (jid, kon, quoted = '', opts = {}) => {
        let list = []
        for (let i of kon) {
            list.push({
                displayName: await VranCe.getName(i + '@s.whatsapp.net'),
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${await VranCe.getName(i + '@s.whatsapp.net')}\nFN:${await VranCe.getName(i + '@s.whatsapp.net')}\nitem1.TEL;waid=${i}:${i}\nitem1.X-ABLabel:Ponsel\nitem2.EMAIL;type=INTERNET:npofficiall@gmail.com\nitem2.X-ABLabel:Email\nitem3.URL:https://bit.ly/420u6GX\nitem3.X-ABLabel:Instagram\nitem4.ADR:;;Indonesia;;;;\nitem4.X-ABLabel:Region\nEND:VCARD`
            })
        }
        VranCe.sendMessage(jid, {
            contacts: {
                displayName: `${list.length} Kontak`,
                contacts: list
            },
            ...opts
        }, {
            quoted
        })
    }

    // Set status function
    VranCe.setStatus = (status) => {
        VranCe.query({
            tag: 'iq',
            attrs: {
                to: '@s.whatsapp.net',
                type: 'set',
                xmlns: 'status',
            },
            content: [{
                tag: 'status',
                attrs: {},
                content: Buffer.from(status, 'utf-8')
            }]
        })
        return status
    }

    VranCe.public = true
    VranCe.serializeM = (m) => smsg(VranCe, m, store)

    // Get file function
    VranCe.getFile = async (PATH, returnAsFilename) => {
        let res, filename
        let data = Buffer.isBuffer(PATH) ? PATH : /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split`,`[1], 'base64') : /^https?:\/\//.test(PATH) ? await (res = await fetch(PATH)).buffer() : fs.existsSync(PATH) ? (filename = PATH, fs.readFileSync(PATH)) : typeof PATH === 'string' ? PATH : Buffer.alloc(0)
        if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer')
        let type = await FileType.fromBuffer(data) || {
            mime: 'application/octet-stream',
            ext: '.bin'
        }
        if (data && returnAsFilename && !filename)(filename = path.join(__dirname, './' + new Date * 1 + '.' + type.ext), await fs.promises.writeFile(filename, data))
        return {
            res,
            filename,
            ...type,
            data
        }
    }

    // Mentions function
    const ments = (teks) => {
        return teks.match('@') ? [...teks.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net') : null
    }

    // Send file function
    VranCe.sendFile = async (jid, path, filename = '', caption = '', quoted, ptt = false, options = {}) => {
        let type = await VranCe.getFile(path, true)
        let {
            res,
            data: file,
            filename: pathFile
        } = type
        if (res && res.status !== 200 || file.length <= 65536) {
            try {
                throw {
                    json: JSON.parse(file.toString())
                }
            } catch (e) {
                if (e.json) throw e.json
            }
        }
        let opt = {
            filename
        }
        if (quoted) opt.quoted = quoted
        if (!type) options.asDocument = true
        let mtype = '',
            mimetype = type.mime,
            convert
        if (/webp/.test(type.mime) || (/image/.test(type.mime) && options.asSticker)) mtype = 'sticker'
        else if (/image/.test(type.mime) || (/webp/.test(type.mime) && options.asImage)) mtype = 'image'
        else if (/video/.test(type.mime)) mtype = 'video'
        else if (/audio/.test(type.mime))(
            convert = await toAudio(file, type.ext),
            file = convert.data,
            pathFile = convert.filename,
            mtype = 'audio',
            mimetype = 'audio/ogg; codecs=opus'
        )
        else mtype = 'document'
        if (options.asDocument) mtype = 'document'

        delete options.asSticker
        delete options.asLocation
        delete options.asVideo
        delete options.asDocument
        delete options.asImage

        let message = {
            ...options,
            caption,
            ptt,
            [mtype]: {
                url: pathFile
            },
            mimetype,
            fileName: filename || pathFile.split('/').pop()
        }
        let m
        try {
            m = await VranCe.sendMessage(jid, message, {
                ...opt,
                ...options
            })
        } catch (e) {
            m = null
        } finally {
            if (!m) m = await VranCe.sendMessage(jid, {
                ...message,
                [mtype]: file
            }, {
                ...opt,
                ...options
            })
            file = null
            return m
        }
    }

    // Send file from URL function
    VranCe.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
        let mime = ''
        let res = await axios.head(url)
        mime = res.headers['content-type']
        if (mime.split("/")[1] === "gif") {
            return VranCe.sendMessage(jid, {
                video: await getBuffer(url),
                caption: caption,
                gifPlayback: true,
                ...options
            }, {
                quoted: quoted,
                ...options
            })
        }
        let type = mime.split("/")[0] + "Message"
        if (mime === "application/pdf") {
            return VranCe.sendMessage(jid, {
                document: await getBuffer(url),
                mimetype: 'application/pdf',
                caption: caption,
                ...options
            }, {
                quoted: quoted,
                ...options
            })
        }
        if (mime.split("/")[0] === "image") {
            return VranCe.sendMessage(jid, {
                image: await getBuffer(url),
                caption: caption,
                ...options
            }, {
                quoted: quoted,
                ...options
            })
        }
        if (mime.split("/")[0] === "video") {
            return VranCe.sendMessage(jid, {
                video: await getBuffer(url),
                caption: caption,
                mimetype: 'video/mp4',
                ...options
            }, {
                quoted: quoted,
                ...options
            })
        }
        if (mime.split("/")[0] === "audio") {
            return VranCe.sendMessage(jid, {
                audio: await getBuffer(url),
                caption: caption,
                mimetype: 'audio/mpeg',
                ...options
            }, {
                quoted: quoted,
                ...options
            })
        }
    }

    // Send text with mentions function
    VranCe.sendTextWithMentions = async (jid, text, quoted, options = {}) => VranCe.sendMessage(jid, {
        text: text,
        mentions: [...text.matchAll(/@(\d{0,16})/g)].map(v => v[1] + '@s.whatsapp.net'),
        ...options
    }, {
        quoted
    })

    // Send image function
    VranCe.sendImage = async (jid, path, caption = '', quoted = '', options) => {
        let buffer = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await fetch(path)).buffer() : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
        return await VranCe.sendMessage(jid, {
            image: buffer,
            caption: caption,
            ...options
        }, {
            quoted
        })
    }

    // Download and save media message function
    VranCe.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
        let quoted = message.msg ? message.msg : message
        let mime = (message.msg || message).mimetype || ''
        let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
        const stream = await downloadContentFromMessage(quoted, messageType)
        let buffer = Buffer.from([])
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk])
        }
        let type = await FileType.fromBuffer(buffer)
        let trueFileName = attachExtension ? ('./cache/' + filename + '.' + type.ext) : './cache/' + filename
        await fs.writeFileSync(trueFileName, buffer)
        return trueFileName
    }

    // Send sticker from URL function
    VranCe.sendStickerFromUrl = async (from, PATH, quoted, options = {}) => {
        let {
            writeExif
        } = require('./data-utils/sticker')
        let types = await VranCe.getFile(PATH, true)
        let {
            filename,
            size,
            ext,
            mime,
            data
        } = types
        let type = '',
            mimetype = mime,
            pathFile = filename
        let media = {
            mimetype: mime,
            data
        }
        pathFile = await writeExif(media, {
            packname: options.packname ? options.packname : '',
            author: options.author ? options.author : author,
            categories: options.categories ? options.categories : []
        })
        await fs.promises.unlink(filename)
        await VranCe.sendMessage(from, {
            sticker: {
                url: pathFile
            }
        }, {
            quoted
        })
        return fs.promises.unlink(pathFile)
    }

    // Download media message function
    VranCe.downloadMediaMessage = async (message) => {
        let mime = (message.msg || message).mimetype || ''
        let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
        const stream = await downloadContentFromMessage(message, messageType)
        let buffer = Buffer.from([])
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk])
        }
        return buffer
    }

    // Send audio function
    VranCe.sendAudio = async (jid, path, quoted = '', ptt = false, options) => {
        let buffer = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await fetch(path)).buffer() : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
        return await VranCe.sendMessage(jid, {
            audio: buffer,
            ptt: ptt,
            ...options
        }, {
            quoted
        })
    }

    // Send video function
    VranCe.sendVideo = async (jid, path, gif = false, caption = '', quoted = '', options) => {
        let buffer = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await fetch(path)).buffer() : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
        return await VranCe.sendMessage(jid, {
            video: buffer,
            caption: caption,
            gifPlayback: gif,
            ...options
        }, {
            quoted
        })
    }

    // Send image as sticker function
    VranCe.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
        let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await global.getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
        let buffer
        if (options && (options.packname || options.author)) {
            buffer = await writeExifImg(buff, options)
        } else {
            buffer = await imageToWebp(buff)
        }
        await VranCe.sendMessage(jid, {
            sticker: {
                url: buffer
            },
            ...options
        }, {
            quoted
        })
        return buffer
    }

    // Send video as sticker function
    VranCe.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
        let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await global.getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
        let buffer
        if (options && (options.packname || options.author)) {
            buffer = await writeExifVid(buff, options)
        } else {
            buffer = await videoToWebp(buff)
        }
        await VranCe.sendMessage(jid, {
            sticker: {
                url: buffer
            },
            ...options
        }, {
            quoted
        })
        return buffer
    }

    // Send media function
    VranCe.sendMedia = async (jid, path, fileName = '', caption = '', quoted = '', options = {}) => {
        let types = await VranCe.getFile(path, true)
        let {
            mime,
            ext,
            res,
            data,
            filename
        } = types
        if (res && res.status !== 200 || file.length <= 65536) {
            try {
                throw {
                    json: JSON.parse(file.toString())
                }
            } catch (e) {
                if (e.json) throw e.json
            }
        }
        let type = '',
            mimetype = mime,
            pathFile = filename
        if (options.asDocument) type = 'document'
        if (options.asSticker || /webp/.test(mime)) {
            let media = {
                mimetype: mime,
                data
            }
            pathFile = await writeExif(media, {
                packname: options.packname ? options.packname : global.packname,
                author: options.author ? options.author : global.author,
                categories: options.categories ? options.categories : []
            })
            await fs.promises.unlink(filename)
            type = 'sticker'
            mimetype = 'image/webp'
        } else if (/image/.test(mime)) type = 'image'
        else if (/video/.test(mime)) type = 'video'
        else if (/audio/.test(mime)) type = 'audio'
        else type = 'document'
        await VranCe.sendMessage(jid, {
            [type]: {
                url: pathFile
            },
            caption,
            mimetype,
            fileName,
            ...options
        }, {
            quoted,
            ...options
        })
        return fs.promises.unlink(pathFile)
    }

    // Copy and forward function
    VranCe.copyNForward = async (jid, message, forceForward = false, options = {}) => {
        let vtype
        if (options.readViewOnce) {
            message.message = message.message && message.message.ephemeralMessage && message.message.ephemeralMessage.message ? message.message.ephemeralMessage.message : (message.message || undefined)
            vtype = Object.keys(message.message.viewOnceMessage.message)[0]
            delete(message.message && message.message.ignore ? message.message.ignore : (message.message || undefined))
            delete message.message.viewOnceMessage.message[vtype].viewOnce
            message.message = {
                ...message.message.viewOnceMessage.message
            }
        }

        let mtype = Object.keys(message.message)[0]
        let content = await generateForwardMessageContent(message, forceForward)
        let ctype = Object.keys(content)[0]
        let context = {}
        if (mtype != "conversation") context = message.message[mtype].contextInfo
        content[ctype].contextInfo = {
            ...context,
            ...content[ctype].contextInfo
        }
        const waMessage = await generateWAMessageFromContent(jid, content, options ? {
            ...content[ctype],
            ...options,
            ...(options.contextInfo ? {
                contextInfo: {
                    ...content[ctype].contextInfo,
                    ...options.contextInfo
                }
            } : {})
        } : {})
        await VranCe.relayMessage(jid, waMessage.message, {
            messageId: waMessage.key.id
        })
        return waMessage
    }

    // Image to sticker function
    VranCe.imgToSticker = async (from, path, quoted, options = {}) => {
        let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await fetchBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
        let buffer
        if (options && (options.packname || options.author)) {
            buffer = await writeExifImg(buff, options)
        } else {
            buffer = await imageToWebp(buff)
        }
        await VranCe.sendMessage(from, {
            sticker: {
                url: buffer
            },
            ...options
        }, {
            quoted
        })
        return buffer
    }

    // Video to sticker function
    VranCe.vidToSticker = async (from, path, quoted, options = {}) => {
        let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await fetchBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
        let buffer
        if (options && (options.packname || options.author)) {
            buffer = await writeExifVid(buff, options)
        } else {
            buffer = await videoToWebp(buff)
        }
        await VranCe.sendMessage(from, {
            sticker: {
                url: buffer
            },
            ...options
        }, {
            quoted
        })
        return buffer
    }

    // Send text function
    VranCe.sendText = (jid, text, quoted = '', options) => VranCe.sendMessage(jid, {
        text: text,
        ...options
    }, {
        quoted,
        ...options
    })

    // Message modifier function
    VranCe.cMod = (jid, copy, text = '', sender = VranCe.user.id, options = {}) => {
        let mtype = Object.keys(copy.message)[0]
        let isEphemeral = mtype === 'ephemeralMessage'
        if (isEphemeral) {
            mtype = Object.keys(copy.message.ephemeralMessage.message)[0]
        }
        let msg = isEphemeral ? copy.message.ephemeralMessage.message : copy.message
        let content = msg[mtype]
        if (typeof content === 'string') msg[mtype] = text || content
        else if (content.caption) content.caption = text || content.caption
        else if (content.text) content.text = text || content.text
        if (typeof content !== 'string') msg[mtype] = {
            ...content,
            ...options
        }
        if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant
        else if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant
        if (copy.key.remoteJid.includes('@s.whatsapp.net')) sender = sender || copy.key.remoteJid
        else if (copy.key.remoteJid.includes('@broadcast')) sender = sender || copy.key.remoteJid
        copy.key.remoteJid = jid
        copy.key.fromMe = sender === VranCe.user.id

        return proto.WebMessageInfo.fromObject(copy)
    }
    
    VranCe.sendButtonImage = async (chat, judul, teks, buffer, button, wmnye = `${wm}`, q) => {
      const uploadFile = {
        upload: VranCe.waUploadToServer
      };
      var imageMessage = await prepareWAMessageMedia({
          image: buffer,
        },
        uploadFile,
      );
      let msg = generateWAMessageFromContent(chat, {
        viewOnceMessage: {
          message: {
            "messageContextInfo": {
              "deviceListMetadata": {},
              "deviceListMetadataVersion": 2
            },
            interactiveMessage: proto.Message.InteractiveMessage.create({
              contextInfo: {
                mentionedJid: ments(teks),
                forwardingScore: 9999999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                  newsletterJid: chjid + "@newsletter",
                  newsletterName: `${wm}`,
                  serverMessageId: -1
                },
                businessMessageForwardInfo: {
                  businessOwnerJid: VranCe.decodeJid(VranCe.user.id)
                },
              },
              body: proto.Message.InteractiveMessage.Body.create({
                text: teks
              }),
              footer: proto.Message.InteractiveMessage.Footer.create({
                text: wmnye
              }),
              header: proto.Message.InteractiveMessage.Header.create({
                title: judul,
                subtitle: `${wm}`,
                imageMessage: imageMessage.imageMessage,
                hasMediaAttachment: true
              }),
              nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                buttons: button,
              })
            })
          }
        }
      }, {
        quoted: q
      })
      VranCe.relayMessage(msg.key.remoteJid, msg.message, {
        messageId: msg.key.id
      })
    }

    VranCe.sendStatusMention = async (content, jids = []) => {
      let users;
      for (let id of jids) {
        let userId = await VranCe.groupMetadata(id)
        users = await userId.participants.map(u => VranCe.decodeJid(u.id))
      }
      let message = await VranCe.sendMessage(
        "status@broadcast", content, {
          backgroundColor: "F54242",
          font: Math.floor(Math.random() * 9),
          statusJidList: users,
          additionalNodes: [{
            tag: "meta",
            attrs: {},
            content: [{
              tag: "mentioned_users",
              attrs: {},
              content: jids.map((jid) => ({
                tag: "to",
                attrs: {
                  jid
                },
                content: undefined,
              })),
            }, ],
          }, ],
        })
      jids.forEach(id => {
        VranCe.relayMessage(id, {
          groupStatusMentionMessage: {
            message: {
              protocolMessage: {
                key: message.key,
                type: 25,
              },
            },
          },
        }, {
          userJid: VranCe.user.jid,
          additionalNodes: [{
            tag: "meta",
            attrs: {
              is_status_mention: "true"
            },
            content: undefined,
          }, ],
        })
        delay(2500)
      })
      return message
    }
    
    VranCe.ments = (teks = '') => {
      return teks.match('@') ? [...teks.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net') : []
    }
    
    return VranCe
}

module.exports = getHandlerMsg

let file = require.resolve(__filename)
fs.watchFile(file, () => {
fs.unwatchFile(file)
console.log(`Update ${__filename}`)
delete require.cache[file]
require(file)})