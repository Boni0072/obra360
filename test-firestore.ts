import { db } from "./firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";

async function runTest() {
  console.log("---------------------------------------------------------");
  console.log("🔥 DIAGNÓSTICO DE CONEXÃO FIREBASE");
  console.log("---------------------------------------------------------");
  console.log(`📦 Project ID configurado: ${db.app.options.projectId}`);
  
  try {
    console.log("1️⃣  Tentando escrever na coleção 'setup_logs'...");
    const docRef = await addDoc(collection(db, "setup_logs"), {
      message: "Teste de conexão realizado com sucesso",
      timestamp: new Date().toISOString(),
      user: "admin-test"
    });
    console.log(`✅ Sucesso! Documento escrito com ID: ${docRef.id}`);

    console.log("2️⃣  Tentando ler a coleção 'setup_logs' para confirmar gravação...");
    const snapshot = await getDocs(collection(db, "setup_logs"));
    console.log(`✅ Sucesso! Lidos ${snapshot.size} documentos do banco.`);
    
    console.log("---------------------------------------------------------");
    console.log("🎉 O servidor está conectado corretamente ao Firebase.");
    console.log("👉 Se o banco parece vazio no navegador, verifique:");
    console.log("   1. Se você selecionou o projeto correto no topo do Console Firebase.");
    console.log(`      Deve ser: ${db.app.options.projectId}`);
    console.log("   2. Se você está olhando para o banco de dados '(default)'.");
    console.log("---------------------------------------------------------");

  } catch (error: any) {
    console.error("❌ ERRO FATAL NO TESTE:");
    console.error(error);
  }
}

runTest();