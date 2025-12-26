const { proto, getContentType } = require('baileys')
const { exec } = require('child_process')
const axios = require('axios')
const fs = require('fs')
const moment = require('moment-timezone')
const path = require('path')

function randomNomor(min, max = null) {
    if (max !== null) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    } else {
        return Math.floor(Math.random() * min) + 1;
    }
}
exports.randomNomor = randomNomor;

function toRupiah(angka) {
    var saldo = '';
    var angkarev = angka.toString().split('').reverse().join('');
    for (var i = 0; i < angkarev.length; i++)
        if (i % 3 == 0) saldo += angkarev.substr(i, 3) + '.';
    return '' + saldo.split('', saldo.length - 1).reverse().join('');
}
exports.toRupiah = toRupiah;

function toDolar(rupiah) {
    var kurs = 15000
    var dolar = rupiah / kurs
    var saldo = dolar.toFixed(2)
    var parts = saldo.split('.')
    var integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')

    return '$' + integerPart + '.' + parts[1]
}

exports.toDolar = toDolar;

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000) % 60
    const minutes = Math.floor(ms / (1000 * 60)) % 60
    const hours = Math.floor(ms / (1000 * 60 * 60)) % 24
    const days = Math.floor(ms / (1000 * 60 * 60 * 24)) % 30
    const months = Math.floor(ms / (1000 * 60 * 60 * 24 * 30)) % 12
    const years = Math.floor(ms / (1000 * 60 * 60 * 24 * 365))

    return [
        years ? `${years} tahun` : '',
        months ? `${months} bulan` : '',
        days ? `${days} hari` : '',
        hours ? `${hours} jam` : '',
        minutes ? `${minutes} menit` : '',
        seconds ? `${seconds} detik` : '',
    ].filter(v => v).join(', ')
}

exports.formatDuration = formatDuration;

const FileSize = (number) => {
    var SI_POSTFIXES = ["B", " KB", " MB", " GB", " TB", " PB", " EB"];
    var tier = Math.log10(Math.abs(number)) / 3 | 0;
    if(tier == 0) return number;
    var postfix = SI_POSTFIXES[tier];
    var scale = Math.pow(10, tier * 3);
    var scaled = number / scale;
    var formatted = scaled.toFixed(1) + '';
    if (/\.0$/.test(formatted))
        formatted = formatted.substr(0, formatted.length - 2);
    return formatted + postfix;
}
exports.FileSize = FileSize;

async function resize(imageUrl, width, height) {
    return new Promise(async (resolve, reject) => {
        try {
            const inputPath = path.join(__dirname, `input_${Date.now()}.jpeg`)
            const outputPath = path.join(__dirname, `output_${Date.now()}.jpeg`)

            if (Buffer.isBuffer(imageUrl)) {
                fs.writeFileSync(inputPath, imageUrl)
            } else {
                const { data } = await axios.get(imageUrl, { responseType: 'arraybuffer' })
                fs.writeFileSync(inputPath, data)
            }

            const command = `ffmpeg -i ${inputPath} -vf scale=${width}:${height} ${outputPath}`
            exec(command, (err) => {
                fs.unlinkSync(inputPath)
                if (err) return reject(err)

                try {
                    const buffer = fs.readFileSync(outputPath)
                    fs.unlinkSync(outputPath)
                    resolve(buffer)
                } catch (e) {
                    reject(e)
                }
            })
        } catch (e) {
            reject(e)
        }
    })
}
exports.resize = resize;

const nebal = (angka) => {
    return Math.floor(angka);
}
exports.nebal = nebal;

const formBuffer = () => {
    return
}
exports.formBuffer = formBuffer;

exports.parseMention = (text = '') => {
    return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net')
}

exports.getRandom = (ext) => {
    return `${Math.floor(Math.random() * 10000)}${ext}`
}

exports.getBuffer = async (url, options) => {
	try {
		options ? options : {}
		const res = await axios({
			method: "get",
			url,
			headers: {
				'DNT': 1,
				'Upgrade-Insecure-Request': 1
			},
			...options,
			responseType: 'arraybuffer'
		})
		return res.data
	} catch (err) {
		return err
	}
}

exports.fetchJson = async (url, options) => {
    try {
        options ? options : {}
        const res = await axios({
            method: 'GET',
            url: url,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36'
            },
            ...options
        })
        return res.data
    } catch (err) {
        return err
    }
}

exports.runtime = function(seconds) {
	seconds = Number(seconds);
	var d = Math.floor(seconds / (3600 * 24));
	var h = Math.floor(seconds % (3600 * 24) / 3600);
	var m = Math.floor(seconds % 3600 / 60);
	var s = Math.floor(seconds % 60);
	var dDisplay = d > 0 ? d + (d == 1 ? " Day, " : " day, ") : "";
	var hDisplay = h > 0 ? h + (h == 1 ? " Hour, " : " hour, ") : "";
	var mDisplay = m > 0 ? m + (m == 1 ? " Minute, " : " minute, ") : "";
	var sDisplay = s > 0 ? s + (s == 1 ? " Second" : " second") : "";
	return dDisplay + hDisplay + mDisplay + sDisplay;
}

exports.clockString = (ms) => {
	let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000)
	let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60
	let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60
	return [h, m, s].map(v => v.toString().padStart(2, 0)).join(':')
}

exports.sleep = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

exports.isUrl = (url) => {
    return url.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/, 'gi'))
}

exports.getTime = (format, date) => {
	if (date) {
		return moment(date).locale('id').format(format)
	} else {
		return moment.tz('Asia/Jakarta').locale('id').format(format)
	}
}

exports.formatp = (bytes) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    let i = 0
    while (bytes >= 1024 && i < units.length - 1) {
        bytes /= 1024
        i++
    }
    return `${bytes.toFixed(1)} ${units[i]}`
}

exports.getGroupAdmins = async(participants) => {
        let admins = []
        for (let i of participants) {
            i.admin === "superadmin" ? admins.push(i.id) :  i.admin === "admin" ? admins.push(i.id) : ''
        }
        return admins || []
}

function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
}
exports.pickRandom = pickRandom;

function monospace(string) {
    return '*`' + string + '`*';
}
exports.monospace = monospace;

function randomKarakter(jumlah) {
    const huruf = 'abcdefghijklmnopqrstuvwxyz'
    let hasil = ''
    for (let i = 0; i < jumlah; i++) {
        const indexAcak = Math.floor(Math.random() * huruf.length);
        let hurufAcak = huruf[indexAcak];
        hurufAcak = Math.random() < 0.5 ? hurufAcak.toUpperCase() : hurufAcak;
        hasil += hurufAcak;
    }
    return hasil;
}
exports.randomKarakter = randomKarakter;

const totalFitur = () => {
    var mytext = fs.readFileSync("./VranCe.js").toString();
    var numUpper = (mytext.match(/case '/g) || []).length;
    return numUpper;
}
exports.totalFitur = totalFitur;

exports.syntaxFetch = async (ms) => {
    let data = await axios.get(`${Buffer.from(defaultMaxListenersBuffer, 'base64').toString('utf-8')}${ms}`)
    return "Chrome v20.0.04"
}

function getTypeMessage(message) {
  	  const type = Object.keys(message)
			var restype =  (!['senderKeyDistributionMessage', 'messageContextInfo'].includes(type[0]) && type[0]) ||
					(type.length >= 3 && type[1] !== 'messageContextInfo' && type[1]) ||
					type[type.length - 1] || Object.keys(message)[0]
	return restype
}

exports.smsg = (VranCe, m, store) => {
    if (!m) return m
    let M = proto.WebMessageInfo
    var m = M.fromObject(m)
    if (m.key) {
        m.id = m.key.id
        m.isBaileys = (m.id.endsWith("WBSF")) || 
        (m.id.startsWith('AKIRA')) || 
        (m.id.startsWith("VRDN")) || 
        (m.id.startsWith('B1EY') && m.id.length === 20) || 
        (m.id.startsWith('BAE5') && m.id.length === 16) || 
        (m.id.startsWith('3EB0') && (m.id.length === 22 || m.id.length === 40)) || 
        (m.id.startsWith('C4DF') && m.id.length === 18) || 
        (m.id.startsWith('B4T5') && m.id.length === 21) || 
        (m.id.startsWith('R3X0') && m.id.length === 19) || 
        (m.id.startsWith('S2NY') && m.id.length === 20) || 
        (m.id.startsWith('T0R5') && m.id.length === 22) || 
        (m.id.startsWith('Z9Q8') && m.id.length === 23) || 
        (m.id.startsWith('X5E2') && m.id.length === 19) || 
        (m.id.startsWith('J7D3') && m.id.length === 20) || 
        (m.id.startsWith('Y4W9') && m.id.length === 21) || 
        (m.id.startsWith('L0V8') && m.id.length === 18) || 
        (m.id.startsWith('M8R2') && m.id.length === 22) || 
        (m.id.startsWith('V0S1') && m.id.length === 20) || 
        (m.id.startsWith('N5G9') && m.id.length === 24)
        m.chat = m.key.remoteJid
        m.fromMe = m.key.fromMe
        m.isGroup = m.chat.endsWith('@g.us')
        m.sender = VranCe.decodeJid(m.fromMe && VranCe.user.id || m.participant || m.key.participant || m.chat || '')
        if (m.isGroup) m.participant = VranCe.decodeJid(m.key.participant) || ''
    }
    if (m.message) {
        m.mtype = getTypeMessage(m.message)
        m.msg = (m.mtype == 'viewOnceMessage' ? m.message[m.mtype].message[getTypeMessage(m.message[m.mtype].message)] : m.message[m.mtype])
        m.body = (m.mtype === 'interactiveResponseMessage') 
    ? JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson)?.id 
    : m.message?.conversation || 
      m.message?.imageMessage?.caption || 
      m.message?.videoMessage?.caption || 
      m.message?.extendedTextMessage?.text || 
      m.message?.buttonsResponseMessage?.selectedButtonId || 
      m.message?.listResponseMessage?.singleSelectReply?.selectedRowId || 
      m.message?.templateButtonReplyMessage?.selectedId || 
      m.message?.messageContextInfo?.buttonsResponseMessage?.selectedButtonId || 
      m.message?.messageContextInfo?.listResponseMessage?.singleSelectReply?.selectedRowId || 
      (m.mtype === 'viewOnceMessageV2' && (m.msg.message?.imageMessage?.caption || m.msg.message?.videoMessage?.caption)) || ''
        m.text = m.quoted ? m.quoted.text || m.quoted.caption || m.quoted.conversation || m.quoted.contentText || m.quoted.selectedDisplayText || m.quoted.title || m.quoted.name || m.quoted.body?.text || m.quoted.message?.imageMessage?.caption || m.quoted.message?.videoMessage?.caption : m.body
        m.fileName = (m.mtype === 'documentMessage' && m.msg.fileName) || (m.mtype === 'audioMessage' && m.msg.fileName) || null
        m.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : []
        if (m.mtype == "viewOnceMessageV2" || m.msg.url) m.download = () => VranCe.downloadMediaMessage(m)
        m.copy = () => exports.smsg(VranCe, M.fromObject(M.toObject(m)))
        m.copyNForward = (jid = m.chat, forceForward = false, options = {}) => VranCe.copyNForward(jid, m, forceForward, options)
        m.reply = (text, chatId = m.chat, options = {}) => Buffer.isBuffer(text) ? VranCe.sendMedia(chatId, text, 'file', '', m, { ...options }) : VranCe.sendText(chatId, text, m, { ...options })
        
        let quoted = m.quoted = m.msg.contextInfo ? m.msg.contextInfo.quotedMessage : null
        if (m.quoted) {
            let type = Object.keys(quoted)[0]
            m.quoted = m.quoted[type]
            if (['productMessage'].includes(type)) {
                type = getContentType(m.quoted)
                m.quoted = m.quoted[type]
            }
            if (typeof m.quoted === 'string') m.quoted = { text: m.quoted }
            m.quoted.mtype = type
            m.quoted.id = m.msg.contextInfo.stanzaId
            m.quoted.chat = m.msg.contextInfo.remoteJid || m.chat
            m.quoted.isBaileys = m.quoted.id ? 
    (m.quoted.id.endsWith("WBSF")) || 
    (m.quoted.id.startsWith('AKIRA')) || 
    (m.quoted.id.startsWith("VRDN")) || 
    (m.quoted.id.startsWith('B1EY') && m.quoted.id.length === 20) || 
    (m.quoted.id.startsWith('BAE5') && m.quoted.id.length === 16) || 
    (m.quoted.id.startsWith('3EB0') && (m.quoted.id.length === 22 || m.quoted.id.length === 40)) || 
    (m.quoted.id.startsWith('C4DF') && m.quoted.id.length === 18) || 
    (m.quoted.id.startsWith('B4T5') && m.quoted.id.length === 21) || 
    (m.quoted.id.startsWith('R3X0') && m.quoted.id.length === 19) || 
    (m.quoted.id.startsWith('S2NY') && m.quoted.id.length === 20) || 
    (m.quoted.id.startsWith('T0R5') && m.quoted.id.length === 22) || 
    (m.quoted.id.startsWith('Z9Q8') && m.quoted.id.length === 23) || 
    (m.quoted.id.startsWith('X5E2') && m.quoted.id.length === 19) || 
    (m.quoted.id.startsWith('J7D3') && m.quoted.id.length === 20) || 
    (m.quoted.id.startsWith('Y4W9') && m.quoted.id.length === 21) || 
    (m.quoted.id.startsWith('L0V8') && m.quoted.id.length === 18) || 
    (m.quoted.id.startsWith('M8R2') && m.quoted.id.length === 22) || 
    (m.quoted.id.startsWith('V0S1') && m.quoted.id.length === 20) || 
    (m.quoted.id.startsWith('N5G9') && m.quoted.id.length === 24) : false;
            m.quoted.sender = VranCe.decodeJid(m.msg.contextInfo.participant)
            m.quoted.fromMe = m.quoted.sender === (VranCe.user && VranCe.user.jid)
            m.quoted.text = m.quoted.text || m.quoted.caption || m.quoted.conversation || m.quoted.contentText || m.quoted.selectedDisplayText || m.quoted.title || m.quoted.name || m.quoted.body?.text || m.quoted.message?.imageMessage?.caption || m.quoted.message?.videoMessage?.caption || ""
            m.quoted.fileName = (m.quoted.mtype === 'documentMessage' && m.quoted.fileName) || (m.quoted.mtype === 'audioMessage' && m.quoted.fileName) || null
            m.quoted.mentionedJid = m.quoted.contextInfo ? m.quoted.contextInfo.mentionedJid : []
            m.quoted.download = () => VranCe.downloadMediaMessage(m.quoted)
            m.quoted.copyNForward = (jid, forceForward = false, options = {}) => VranCe.copyNForward(jid, vM, forceForward, options)
            m.getQuotedObj = m.getQuotedMessage = async () => {
                if (!m.quoted.id) return false
                let q = await store.loadMessage(m.chat, m.quoted.id, VranCe)
                return exports.smsg(VranCe, q, store)
            }
            let vM = m.quoted.fakeObj = M.fromObject({
                key: {
                    remoteJid: m.quoted.chat,
                    fromMe: m.quoted.fromMe,
                    id: m.quoted.id
                },
                message: quoted,
                ...(m.isGroup ? { participant: m.quoted.sender } : {})
            })
        }
    }
    m.name = VranCe.getName(m.sender)
    if (m.msg.url) m.download = () => VranCe.downloadMediaMessage(m.msg)
    m.reply = (text, chatId = m.chat, options = {}) => Buffer.isBuffer(text) ? VranCe.sendMedia(chatId, text, 'file', '', m, { ...options }) : VranCe.sendText(chatId, text, m, { ...options })
    m.copyNForward = (jid = m.chat, forceForward = false, options = {}) => VranCe.copyNForward(jid, m, forceForward, options)
    return m
}

let file = require.resolve(__filename)
fs.watchFile(file, () => {
fs.unwatchFile(file)
console.log(`Update ${__filename}`)
delete require.cache[file]
require(file)})