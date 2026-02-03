import admin from 'firebase-admin';
import { ENV } from './env';

// Garante que a inicialização só ocorra uma vez
if (!admin.apps.length) {
  console.log('🔥 Inicializando Firebase Admin SDK...');
  try {
    const serviceAccountString = ENV.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountString) {
      throw new Error('A variável de ambiente FIREBASE_SERVICE_ACCOUNT_KEY não está definida.');
    }

    // O conteúdo da variável de ambiente é a string JSON completa da chave da conta de serviço
    const serviceAccount = JSON.parse(serviceAccountString);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: ENV.FIREBASE_DATABASE_URL,
    });
    console.log('✅ Firebase Admin SDK inicializado com sucesso!');
  } catch (error: any) {
    console.error('❌ Erro Crítico ao inicializar o Firebase Admin SDK:', error.message);
    console.error('👉 Verifique se a variável de ambiente FIREBASE_SERVICE_ACCOUNT_KEY contém o JSON válido da sua chave de serviço do Firebase.');
    console.error('👉 Verifique se a variável de ambiente FIREBASE_DATABASE_URL está definida corretamente.');
    // Em um ambiente de produção, você pode querer que o aplicativo pare se o Admin SDK não puder ser inicializado.
    // process.exit(1);
  }
}

export const firebaseAdmin = admin;
