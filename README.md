├── index.html          # Halaman utama (Homepage)
├── style.css           # Stylesheet utama (pitch-black theme, responsive, CSS variables)
├── script.js           # Logic interaktivitas & pembacaan data di Homepage
├── anime-api.js        # Service layer client-side untuk memanggil proxy /api/anime
├── firebase.js         # Inisialisasi SDK Firebase Realtime Database
├── chat.js             # Logic pengiriman & penerimaan pesan chat secara realtime
├── anime.html          # Halaman katalog & perpustakaan anime
├── anime.js            # Logic filter, pencarian, dan pagination di halaman Anime Library
├── detail.html         # Halaman detail & informasi anime
├── detail.js           # Logic untuk memuat data detail anime & episode
├── watch.html          # Halaman pemutar video & pemutaran episode
├── watch.js            # Logic player video, pilihan kualitas, dan penyimpanan progress
├── chat.html           # Halaman diskusi / Global Chat realtime
├── database.rules.json # Aturan keamanan (Security Rules) Firebase Realtime Database
├── .env.example        # Template konfirmasi Environment Variable untuk Vercel
├── vercel.json         # Konfigurasi routing & header keamanan Vercel
└── api/
    └── anime.js        # Vercel Serverless Function (Proxy aman untuk Anime API)
