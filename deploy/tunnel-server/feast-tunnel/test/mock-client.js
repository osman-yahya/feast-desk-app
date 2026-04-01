/**
 * Mock POS client for testing the feast-tunnel server.
 *
 * Usage:
 *   node test/mock-client.js [server_url] [restaurant_id] [secret]
 *
 * Defaults:
 *   server_url:    http://localhost:4000
 *   restaurant_id: 1
 *   secret:        test_secret
 *
 * This script:
 *   1. Registers with the tunnel server (POST /api/register)
 *   2. Opens a tunnel WebSocket and authenticates
 *   3. Handles http_req frames by responding with mock data
 *   4. Handles ws_open/ws_msg/ws_close by echoing back
 *   5. Prints the access URL for manual browser testing
 */

import WebSocket from 'ws'   // only needed if running outside of a browser
import { createServer } from 'http'

const SERVER_URL = process.argv[2] || 'http://localhost:4000'
const RESTAURANT_ID = parseInt(process.argv[3] || '7', 10)
const SECRET = process.argv[4] || 'ak7Unk0'

// Mock menu data
const MOCK_MENU = {
  "categories": [
    {
      "id": 1,
      "name": "Çorbalar",
      "items": [
        {
          "id": 1,
          "name": "Mercimek Çorbası",
          "price": "95",
          "badges": [],
          "calories": null,
          "sold_out": true,
          "allergens": [],
          "description": "Süzme kırmızı mercimeğin, kök sebzelerle ağır ateşte demlenerek pişen ipeksi dokusu; üzerine gezdirilen kızgın tereyağlı nane sosu ve yanında çıtır kıtır ekmek dilimleriyle bir klasik.",
          "item_picture": "item_pictures/1/1/1771087032893.webp"
        },
        {
          "id": 2,
          "name": "Ezogelin Çorbası",
          "price": "90",
          "badges": [
            "halal",
            "vegan",
            "organic"
          ],
          "calories": null,
          "sold_out": false,
          "allergens": [
            "gluten",
            "peanuts"
          ],
          "description": "Anadolu’nun bereketli topraklarından gelen kırmızı mercimek, bulgur ve pirincin; mis kokulu kuru nane, acı pul biber ve özenle kavrulmuş domates salçasıyla harmanlandığı, geleneksel bir şifa kaynağı.",
          "item_picture": "item_pictures/1/1/1771087058749.webp"
        },
        {
          "id": 3,
          "name": "Domates Çorbası",
          "price": "95",
          "badges": [],
          "calories": 500,
          "sold_out": false,
          "allergens": [],
          "description": "Güneşte olgunlaşmış taze domateslerin fırınlanarak köz aromasıyla buluştuğu, üzerine serpiştirilen taze rendelenmiş kaşar peyniri ve altın sarısı krutonlarla servis edilen kadifemsi lezzet.",
          "item_picture": "item_pictures/1/1/1771087084170.webp"
        },
        {
          "id": 4,
          "name": "Mantar Çorbası",
          "price": "105",
          "badges": [
            "extra_spicy",
            "dairy_free",
            "organic",
            "sugar_free",
            "chef_special",
            "vegetarian"
          ],
          "calories": 500,
          "sold_out": true,
          "allergens": [
            "crustaceans",
            "tree_nuts",
            "sulphur_dioxide",
            "lupin",
            "celery"
          ],
          "description": "Orman esintili taze kültür mantarlarının, yoğun krema ve taze kekik dallarıyla buluştuğu, her kaşıkta mantarın yoğun aromasını hissettiren gurme bir başlangıç.",
          "item_picture": "item_pictures/1/1/1772453115197.webp"
        }
      ]
    },
    {
      "id": 2,
      "name": "Ana Yemekler",
      "items": [
        {
          "id": 5,
          "name": "Fırında Somon Izgara",
          "price": "420",
          "description": "Norveç’in soğuk sularından gelen taze somonun, taze biberiye ve sarımsakla mühürlendikten sonra fırınlanması; yanında ızgara kuşkonmaz ve narenciye notalı kapari sosuyla.",
          "item_picture": "item_pictures/1/1/1771087146257.webp"
        },
        {
          "id": 6,
          "name": "Dana Antrikot",
          "price": "550",
          "description": "Özel marinasyonla 28 gün boyunca dinlendirilmiş, döküm tavada mühürlenerek suyunun hapsedildiği yumuşacık dana antrikot; yanında kremalı patates püresi ve fırınlanmış kök sebzelerle.",
          "item_picture": "item_pictures/1/1/1771087168651.webp"
        },
        {
          "id": 7,
          "name": "Tavuk Sote",
          "price": "280",
          "description": "Bahçe tazeliğindeki renkli kapya biberler, kültür mantarları ve arpacık soğanlarla harlı ateşte sotelenmiş körpe tavuk parçaları; tane tane dökülen tereyağlı pirinç pilavı eşliğinde.",
          "item_picture": "item_pictures/1/1/1771087199425.webp"
        },
        {
          "id": 8,
          "name": "Kuzu Tandır",
          "price": "480",
          "description": "Kuzu etinin kendi suyunda, taş fırında saatlerce kısık ateşte pişerek kemiğinden ayrılacak kıvama geldiği efsanevi lezzet; bademli ve kuş üzümlü iç pilavı ile.",
          "item_picture": "item_pictures/1/1/1771087218894.webp"
        },
        {
          "id": 9,
          "name": "İskender Kebap",
          "price": "410",
          "description": "İncecik yaprak kesim döner etlerinin, fırınlanmış tırnak pide yatağında; üzerine dökülen mis kokulu Bursa tereyağı, özel domates sosu ve yanında ev yapımı koyu yoğurtla.",
          "item_picture": "item_pictures/1/1/1771087238104.webp"
        },
        {
          "id": 10,
          "name": "Mantı",
          "price": "260",
          "description": "Sabırla açılan incecik hamurların arasına gizlenmiş özel baharatlı kıyma; üzerine sarımsaklı süzme yoğurt, kızdırılmış pul biberli tereyağı ve kuru nane dokunuşuyla.",
          "item_picture": "item_pictures/1/1/1771087259509.webp"
        },
        {
          "id": 11,
          "name": "Karnıyarık",
          "price": "240",
          "description": "Yaz güneşinde yetişmiş patlıcanların, köz aromasını içine çeken kıymalı, domatesli ve biberli özel harçla doldurulup fırınlanmış hali; yanında geleneksel pilav ile.",
          "item_picture": "item_pictures/1/1/1771087280765.webp"
        },
        {
          "id": 12,
          "name": "Püreli Köfte",
          "price": "290",
          "description": "Anne eli değmişçesine hazırlanan ızgara köfteler; altında bulut gibi hafif patates püresi, üzerinde ise közlenmiş biber ve domateslerin eşsiz uyumu.",
          "item_picture": "item_pictures/1/1/1771087309641.webp"
        },
        {
          "id": 13,
          "name": "Enginar Dolması",
          "price": "220",
          "description": "Ege’nin taze enginar çanaklarının; dereotu, taze bezelye ve bahar sebzeleriyle hazırlanan zeytinyağlı harçla buluştuğu, hafif ve ferahlatıcı bir vegan şöleni.",
          "item_picture": "item_pictures/1/1/1771087327987.webp"
        },
        {
          "id": 14,
          "name": "Sebzeli Lazanya",
          "price": "270",
          "description": "Kat kat taze makarna yaprakları arasında mevsim sebzeleri, ev yapımı beşamel sos ve altın sarısı mozzarella peynirinin fırında nar gibi kızarmış buluşması.",
          "item_picture": "item_pictures/1/1/1771087349509.webp"
        }
      ]
    },
    {
      "id": 3,
      "name": "Tatlılar",
      "items": [
        {
          "id": 15,
          "name": "Sufle",
          "price": "150",
          "description": "Kaliteli bitter çikolatanın sıcak ve akışkan kalbiyle buluştuğu, yanında bir top soğuk vanilyalı dondurmanın yarattığı muazzam sıcak-soğuk dengesi.",
          "item_picture": "item_pictures/1/1/1771089545850.webp"
        },
        {
          "id": 16,
          "name": "Tiramisu",
          "price": "165",
          "description": "Yumuşacık Mascarpone peyniri ve espresso ile ıslatılmış kedi dili bisküvilerinin, üzerine serpiştirilen yoğun kakao ile İtalyan rüyasına dönüşümü.",
          "item_picture": "item_pictures/1/1/1771087403747.webp"
        },
        {
          "id": 17,
          "name": "Fıstıklı Katmer",
          "price": "190",
          "description": "Çıtır çıtır açılmış incecik hamur katları arasında bolca Antep fıstığı ve sahan kaymağının, fırından çıktığı an şerbetle buluşan sıcak masalı.",
          "item_picture": "item_pictures/1/1/1771087419199.webp"
        },
        {
          "id": 18,
          "name": "Cheesecake",
          "price": "155",
          "description": "New York usulü fırınlanmış, pürüzsüz kremamsı dokusu ve üzerinde orman meyvelerinden hazırlanan mayhoş sosun yarattığı modern lezzet.",
          "item_picture": "item_pictures/1/1/1771087438179.webp"
        }
      ]
    },
    {
      "id": 4,
      "name": "İçecekler",
      "items": [
        {
          "id": 19,
          "name": "Ev Yapımı Limonata",
          "price": "75",
          "description": "Dalından yeni koparılmış limonların taze nane yaprakları ve çubuk tarçınla saatlerce demlenerek hazırlanan, serinletici ve doğal lezzet.",
          "item_picture": "item_pictures/1/1/1771087469587.webp"
        },
        {
          "id": 20,
          "name": "Taze Sıkılmış Portakal Suyu",
          "price": "85",
          "description": "Akdeniz güneşini bardağınıza taşıyan, anlık olarak hazırlanan %100 doğal ve vitamin dolu enerji kaynağı.",
          "item_picture": "item_pictures/1/1/1771087490633.webp"
        },
        {
          "id": 21,
          "name": "Ayran",
          "price": "45",
          "description": "Bakır kaselerde servis edilen, tam yağlı yoğurttan yayık usulüyle hazırlanan bol köpüklü ve buz gibi bir ferahlık.",
          "item_picture": "item_pictures/1/1/1771087507165.webp"
        },
        {
          "id": 22,
          "name": "Türk Kahvesi",
          "price": "70",
          "description": "Özenle kavrulmuş kaliteli kahve çekirdeklerinden, bakır cezvede ağır ateşte pişmiş bol köpüklü kahve; yanında çifte kavrulmuş lokum ile. ",
          "item_picture": "item_pictures/1/1/1771087523400.webp"
        }
      ]
    },
    {
      "id": 5,
      "name": "Aperatifler",
      "items": [
        {
          "id": 23,
          "name": "Patates Kızartması",
          "price": "110",
          "description": "Özel baharat karışımıyla harmanlanmış, dışı çıtır içi yumuşak altın sarısı patatesler; yanında ev yapımı trüflü mayonez ve acılı ketçap ile.",
          "item_picture": "item_pictures/1/1/1771087585748.webp"
        },
        {
          "id": 24,
          "name": "Tavuk Tenders",
          "price": "170",
          "description": "Mısır gevreği ile kaplanarak dışına ekstra çıtırlık kazandırılmış, içi sulu kalmış tavuk göğsü dilimleri; ballı hardal sos eşliğinde.",
          "item_picture": "item_pictures/1/1/1771087610908.webp"
        }
      ]
    },
    {
      "id": 6,
      "name": "Başlangıçlar",
      "items": [
        {
          "id": 25,
          "name": "Humus",
          "price": "115",
          "description": "Haşlanmış nohut ve taze tahinin, sarımsak ve kimyonla pürüzsüz bir kıvama gelene kadar dövüldüğü; üzerinde kızgın tereyağlı pastırma dilimleriyle.",
          "item_picture": "item_pictures/1/1/1771089014724.webp"
        },
        {
          "id": 26,
          "name": "Paçanga Böreği",
          "price": "160",
          "description": "Çıtır yufka içerisinde kayseri pastırması, eriyen kaşar peyniri, renkli biberler ve domatesin sıcak birleşimi; yağ çekmeden kızartılmış haliyle.",
          "item_picture": "item_pictures/1/1/1771089024249.webp"
        },
        {
          "id": 29,
          "name": "Zeytinyağlı Yaprak Sarma",
          "price": "135",
          "description": "Ege’nin incecik asma yapraklarına sarılmış; kuş üzümü, dolmalık fıstık ve taze baharatlarla zenginleştirilmiş, sızma zeytinyağı ve limon dilimleriyle servis edilen bir gelenek.",
          "item_picture": "item_pictures/1/1/1771089039482.webp"
        },
        {
          "id": 30,
          "name": "Mütebbel",
          "price": "130",
          "description": "Közlenmiş patlıcanın tahin, süzme yoğurt ve sarımsakla buluştuğu; üzerine nar taneleri ve taze nane serpilerek sunulan isli ve kremsi bir Orta Doğu klasiği.",
          "item_picture": "item_pictures/1/1/1771089059806.webp"
        }
      ]
    },
    {
      "id": 7,
      "name": "Salatalar",
      "items": [
        {
          "id": 27,
          "name": "Gavurdağı Salatası",
          "price": "145",
          "description": "İncecik kıyılmış domates, salatalık ve yeşil biberin; bol ceviz içi, nar ekşisi ve sızma zeytinyağı ile hazırlanan iştah açıcı birlikteliği.",
          "item_picture": "item_pictures/1/1/1771089086477.webp"
        },
        {
          "id": 28,
          "name": "Sezar Salatası",
          "price": "210",
          "description": "Taze marul yapraklarının, ızgara tavuk dilimleri, parmesan peyniri rendesi ve altın sarısı krutonlarla; özel Sezar sosun eşsiz dokunuşuyla buluşması.",
          "item_picture": "item_pictures/1/1/1771089097747.webp"
        },
        {
          "id": 31,
          "name": "Roka & Parmesan Salatası",
          "price": "195",
          "description": "Körpe roka yapraklarının üzerine serpiştirilmiş fırınlanmış çeri domatesler, çam fıstığı ve ince dilimlenmiş parmesan peyniri; balzamik sirke ve zeytinyağı sosu eşliğinde.",
          "item_picture": "item_pictures/1/1/1771089106475.webp"
        },
        {
          "id": 32,
          "name": "Kinoa & Avokado Salatası",
          "price": "225",
          "description": "Haşlanmış beyaz kinoa, taze avokado dilimleri, kapya biber, mısır ve ince kıyılmış maydanozun narenciye sosuyla harmanlandığı, hem doyurucu hem hafif bir sağlık deposu.",
          "item_picture": "item_pictures/1/1/1771087752526.webp"
        },
        {
          "id": 33,
          "name": "Gavurdağ Salatası",
          "price": "180",
          "description": "Gavurdağından toplanan sebzelerle hazırlanır",
          "item_picture": "item_pictures/1/1/1772894067501.webp"
        }
      ]
    }
  ]
}

async function main() {
  console.log(`\n--- feast-tunnel Mock Client ---`)
  console.log(`Server: ${SERVER_URL}`)
  console.log(`Restaurant ID: ${RESTAURANT_ID}\n`)

  // Step 1: Register
  console.log('[1] Registering...')
  const regRes = await fetch(`${SERVER_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurant_id: RESTAURANT_ID, secret: SECRET }),
  })

  const regBody = await regRes.json()
  if (!regBody.success) {
    console.error(`Registration failed: ${regBody.message}`)
    process.exit(1)
  }

  const { token, access_key } = regBody
  console.log(`[1] Token: ${token}`)
  console.log(`[1] Access Key: ${access_key}\n`)

  // Step 2: Open tunnel WebSocket
  const wsUrl = SERVER_URL.replace('http', 'ws') + '/tunnel'
  console.log(`[2] Connecting WebSocket: ${wsUrl}`)
  const ws = new WebSocket(wsUrl)

  ws.on('open', () => {
    console.log('[2] WebSocket connected, sending auth...')
    ws.send(JSON.stringify({ t: 'auth', token }))
  })

  ws.on('message', (raw) => {
    const frame = JSON.parse(raw.toString())

    switch (frame.t) {
      case 'auth_ok':
        console.log(`[2] Authenticated!`)
        console.log(`\n    Access URL: ${frame.access_url}`)
        console.log(`    Kitchen:    ${frame.access_url}?role=kitchen`)
        console.log(`\n--- Listening for requests ---\n`)
        break

      case 'auth_fail':
        console.error(`[2] Auth failed: ${frame.reason}`)
        process.exit(1)

      case 'ping':
        ws.send(JSON.stringify({ t: 'pong' }))
        break

      case 'http_req':
        handleHttpReq(ws, frame)
        break

      case 'ws_open':
        console.log(`[WS] Stream ${frame.s} opened: ${frame.path}`)
        ws.send(JSON.stringify({ t: 'ws_accept', s: frame.s }))
        break

      case 'ws_msg':
        console.log(`[WS] Stream ${frame.s} message: ${frame.data}`)
        // Echo back
        ws.send(JSON.stringify({ t: 'ws_msg', s: frame.s, data: frame.data }))
        break

      case 'ws_close':
        console.log(`[WS] Stream ${frame.s} closed: ${frame.code}`)
        break

      default:
        console.log(`[?] Unknown frame: ${JSON.stringify(frame)}`)
    }
  })

  ws.on('close', (code) => {
    console.log(`\n[!] Tunnel WebSocket closed (code: ${code})`)
    process.exit(0)
  })

  ws.on('error', (err) => {
    console.error(`[!] WebSocket error: ${err.message}`)
    process.exit(1)
  })
}

function handleHttpReq(ws, frame) {
  console.log(`[HTTP] ${frame.method} ${frame.path} (stream ${frame.s})`)

  let status = 200
  let body = ''
  let headers = { 'Content-Type': 'application/json' }

  if (frame.path === '/api/menu' || frame.path.startsWith('/api/menu?')) {
    body = JSON.stringify(MOCK_MENU)
  } else if (frame.path === '/api/orders' || frame.path.startsWith('/api/orders?')) {
    body = JSON.stringify([])
  } else if (frame.path === '/api/floors' || frame.path.startsWith('/api/floors?')) {
    body = JSON.stringify([{ id: 1, name: 'Main Floor', tables: [] }])
  } else if (frame.path === '/' || frame.path === '/index.html') {
    headers['Content-Type'] = 'text/html'
    body = `<!DOCTYPE html>
<html><head><title>feast. Mock POS</title></head>
<body>
<h1>feast. Tunnel Test</h1>
<p>This is the mock POS serving through the tunnel.</p>
<p>Stream ID: ${frame.s}</p>
<pre>Menu: ${JSON.stringify(MOCK_MENU, null, 2)}</pre>
</body></html>`
  } else {
    status = 404
    body = JSON.stringify({ message: 'Not found' })
  }

  ws.send(JSON.stringify({
    t: 'http_res',
    s: frame.s,
    status,
    headers,
    body,
  }))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
