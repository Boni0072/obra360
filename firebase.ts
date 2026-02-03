import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import "dotenv/config";

const firebaseConfig = {
  apiKey: "AIzaSyBZ2zlstYh5od_ut-YOgDUDtFjIiPUIvhk",
  authDomain: "obahrtfruit.firebaseapp.com",
  projectId: "obahrtfruit",
  storageBucket: "obahrtfruit.firebasestorage.app",
  messagingSenderId: "162023336669",
  appId: "1:162023336669:web:5d3069a8dce75eb38b4934"
};

// Validação simples para ajudar no debug
if (!firebaseConfig.apiKey) {
  console.error("❌ ERRO CRÍTICO: Chaves do Firebase não encontradas no servidor. Verifique o arquivo .env.");
}

const app = initializeApp(firebaseConfig);
console.log(`🔥 Firebase inicializado no servidor. Projeto: ${firebaseConfig.projectId}`);
export const db = getFirestore(app);