require('../settings')
const axios = require('axios')
const chalk = require('chalk')
const FormData = require('form-data')
const fs = require('fs')
const fetch = require('node-fetch')
const ffmpeg = require('fluent-ffmpeg')
const path = require('path')
const { fromBuffer } = require('file-type')

const {
  fetchJson,
  randomKarakter
} = require('../lib/myfunc')

const api = axios.create({
  baseURL: 'https://api4g.iloveimg.com'
})

const getTaskId = async () => {
  const {
    data: html
  } = await axios.get('https://www.iloveimg.com/id/hapus-latar-belakang')
  api.defaults.headers.post['authorization'] = `Bearer ${html.match(/ey[a-zA-Z0-9?%-_/]+/g)[1]}`
  return html.match(/taskId = '(\w+)/)[1]
}

const uploadImageToServer = async (imageBuffer) => {
  const taskId = await getTaskId()

  const fileName = Math.random().toString(36).slice(2) + '.jpg'
  const form = new FormData()
  form.append('name', fileName)
  form.append('chunk', '0')
  form.append('chunks', '1')
  form.append('task', taskId)
  form.append('preview', '1')
  form.append('pdfinfo', '0')
  form.append('pdfforms', '0')
  form.append('pdfresetforms', '0')
  form.append('v', 'web.0')
  form.append('file', imageBuffer, fileName)

  const reqUpload = await api.post('/v1/upload', form, {
      headers: form.getHeaders()
    })
    .catch(e => e.response)
  if (reqUpload.status !== 200) throw reqUpload.data || reqUpload.statusText

  return {
    serverFilename: reqUpload.data.server_filename,
    taskId
  }
}

async function CatBox(path) {
  const data = new FormData()
  data.append('reqtype', 'fileupload')
  data.append('userhash', '')
  data.append('fileToUpload', fs.createReadStream(path))
  const config = {
    method: 'POST',
    url: 'https://catbox.moe/user/api.php',
    headers: {
      ...data.getHeaders(),
      'User-Agent': 'Mozilla/5.0 (Android 10; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
    },
    data: data
  }
  const api = await axios.request(config)
  return api.data
}

const removeBg = async (imageBuffer, responseType = 'arraybuffer') => {
  const {
    serverFilename,
    taskId
  } = await uploadImageToServer(imageBuffer)

  const form = new FormData()
  form.append('task', taskId)
  form.append('server_filename', serverFilename)

  const reqRmbg = await api.post('/v1/removebackground', form, {
    headers: form.getHeaders(),
    responseType
  }).catch(e => e.response)
  const type = reqRmbg.headers['content-type']
  if (reqRmbg.status !== 200 || !/image/.test(type))
    throw JSON.parse(reqRmbg.data?.toString() || '{"error":{"message":"An error occurred"}}')

  return reqRmbg.data
}

async function upScale(path, VranCe, m, chatId) {
  try {
    const form = new FormData();
    form.append("image", fs.createReadStream(path));
    form.append("scale", 2);

    const headers = {
      ...form.getHeaders()
    };

    const { data } = await axios.post("https://api2.pixelcut.app/image/upscale/v1", form, { headers, responseType: 'arraybuffer' });

    await VranCe.sendMessage(chatId, { image: Buffer.from(data) }, {quoted: m})
  } catch (error) {
    console.error(error);
  }
}

async function remini(imageData, action) {
  return new Promise(async (resolve, reject) => {
    let actions = ['enhance', 'recolor', 'dehaze'];
    if (!actions.includes(action)) {
      action = actions[0];
    }

    let formData = new FormData();
    let url = `https://inferenceengine.vyro.ai/${action}`;

    formData.append('model_version', 1, {
      'Content-Transfer-Encoding': 'binary',
      'contentType': 'multipart/form-data; charset=uttf-8'
    });

    formData.append('image', Buffer.from(imageData), {
      'filename': 'enhance_image_body.jpg',
      'contentType': 'image/jpeg'
    });

    formData.submit({
      'url': url,
      'host': 'inferenceengine.vyro.ai',
      'path': `/${action}`,
      'protocol': 'https:',
      'headers': {
        'User-Agent': 'okhttp/4.9.3',
        'Connection': 'Keep-Alive',
        'Accept-Encoding': 'gzip'
      }
    }, function (err, res) {
      if (err) {
        reject();
        return;
      }

      let chunks = [];
      res.on('data', chunk => {
        chunks.push(chunk);
      }).on('end', () => {
        resolve(Buffer.concat(chunks));
      }).on('error', () => {
        reject();
      });
    });
  });
}

async function Pxpic(path, func) {
  const tool = ['removebg', 'enhance', 'upscale', 'restore', 'colorize']
  if (!tool.includes(func)) return `Tersedia: ${tool.join(', ')}`

  const buffer = fs.readFileSync(path)
  const fileInfo = await fromBuffer(buffer)
  const ext = fileInfo?.ext || 'bin'
  const mime = fileInfo?.mime || 'application/octet-stream'
  const fileName = Math.random().toString(36).slice(2, 8)+'.'+ext

  const { data } = await axios.post("https://pxpic.com/getSignedUrl", {
    folder: "uploads",
    fileName
  }, { headers: { "Content-Type": "application/json" } })

  await axios.put(data.presignedUrl, buffer, { headers: { "Content-Type": mime } })
  const url = "https://files.fotoenhancer.com/uploads/"+fileName

  const api = await axios.post("https://pxpic.com/callAiFunction", new URLSearchParams({
    imageUrl: url,
    targetFormat: 'png',
    needCompress: 'no',
    imageQuality: '100',
    compressLevel: '6',
    fileOriginalExtension: 'png',
    aiFunction: func,
    upscalingLevel: ''
  }).toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Android 10; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/png,image/svg+xml,*/*;q=0.8',
      'Content-Type': 'application/x-www-form-urlencoded',
      'accept-language': 'id-ID'
    }
  })

  return api.data
}

async function tiktokDl(url) {
  return new Promise(async (resolve, reject) => {
    try {
      let data = []

      function formatNumber(integer) {
        let numb = parseInt(integer)
        return Number(numb).toLocaleString().replace(/,/g, '.')
      }

      function formatDate(n, locale = 'en') {
        let d = new Date(n)
        return d.toLocaleDateString(locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric'
        })
      }

      let domain = 'https://www.tikwm.com/api/';
      let res = await (await axios.post(domain, {}, {
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Origin': 'https://www.tikwm.com',
          'Referer': 'https://www.tikwm.com/',
          'Sec-Ch-Ua': '"Not)A;Brand" ;v="24" , "Chromium" ;v="116"',
          'Sec-Ch-Ua-Mobile': '?1',
          'Sec-Ch-Ua-Platform': 'Android',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest'
        },
        params: {
          url: url,
          count: 12,
          cursor: 0,
          web: 1,
          hd: 1
        }
      })).data.data
      if (!res.size) {
        res.images.map(v => {
          data.push({
            type: 'photo',
            url: v
          })
        })
      } else {
        data.push({
          type: 'watermark',
          url: 'https://www.tikwm.com' + res.wmplay,
        }, {
          type: 'nowatermark',
          url: 'https://www.tikwm.com' + res.play,
        }, {
          type: 'nowatermark_hd',
          url: 'https://www.tikwm.com' + res.hdplay
        })
      }
      let json = {
        status: true,
        title: res.title,
        taken_at: formatDate(res.create_time).replace('1970', ''),
        region: res.region,
        id: res.id,
        durations: res.duration,
        duration: res.duration + ' Seconds',
        cover: 'https://www.tikwm.com' + res.cover,
        size_wm: res.wm_size,
        size_nowm: res.size,
        size_nowm_hd: res.hd_size,
        data: data,
        music_info: {
          id: res.music_info.id,
          title: res.music_info.title,
          author: res.music_info.author,
          album: res.music_info.album ? res.music_info.album : null,
          url: 'https://www.tikwm.com' + res.music || res.music_info.play
        },
        stats: {
          views: formatNumber(res.play_count),
          likes: formatNumber(res.digg_count),
          comment: formatNumber(res.comment_count),
          share: formatNumber(res.share_count),
          download: formatNumber(res.download_count)
        },
        author: {
          id: res.author.id,
          fullname: res.author.unique_id,
          nickname: res.author.nickname,
          avatar: 'https://www.tikwm.com' + res.author.avatar
        }
      }
      resolve(json)
    } catch (e) {
      reject(e)
    }
  });
}

async function pinterest(query) {
  try {
    const { data } = await axios.get(
      `https://api.vreden.my.id/api/v1/search/pinterest?query=${encodeURIComponent(query)}`,
    );

    return data.result.search_data[
      Math.floor(Math.random() * data.result.search_data.length)
    ];
  } catch (err) {
    throw Error(err.message);
  }
}

async function yt_search(src) {
  try {
    const response = await axios.get(`https://api.vreden.my.id/api/yts?query=${encodeURIComponent(src)}`);
    const data = response.data?.result?.all || [];

    const result = data
      .filter(video => video.type === 'video')
      .map(video => ({
        url: video.url || '',
        title: video.title || 'Tanpa Judul',
        description: video.description || '',
        videoId: video.videoId || '',
        timestamp: video.timestamp || '',
        duration: video.duration?.timestamp || '',
        ago: video.ago || '',
        views: video.views || 0,
        author: video.author?.name || '',
        authorUrl: video.author?.url || '',
        thumbnail: video.thumbnail || video.image || ''
      }));

    return result;
  } catch (err) {
    console.error('Terjadi kesalahan:', err.message);
    return [];
  }
}

async function gimage(query) {
  try {
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&cx=e5c2be9c3f94c4bbb&searchType=image&key=AIzaSyAajE2Y-Kgl8bjPyFvHQ-PgRUSMWgBEsSk`

    const { data } = await axios.get(url)
    const results = data.items.map(item => ({
      title: item.title,
      link: item.link,
      contextLink: item.image.contextLink
    }))

    return results
  } catch (error) {
    return []
  }
}

async function tiktokSearchVideo(query) {
  return new Promise(async (resolve, reject) => {
    axios("https://tikwm.com/api/feed/search", {
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        cookie: "current_language=en",
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
      },
      data: {
        keywords: query,
        count: 12,
        cursor: 0,
        web: 1,
        hd: 1,
      },
      method: "POST",
    }).then((res) => {
      resolve(res.data.data)
    })
  })
}

module.exports = {
  CatBox,
  removeBg,
  upScale,
  remini,
  Pxpic,
  tiktokDl,
  pinterest,
  yt_search,
  gimage,
  tiktokSearchVideo
}

let file = require.resolve(__filename)
fs.watchFile(file, () => {
fs.unwatchFile(file)
console.log(`Update ${__filename}`)
delete require.cache[file]
require(file)})