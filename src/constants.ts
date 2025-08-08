export const SERVER_URL = import.meta.env.VITE_PRODUCTION ? 'https://api.porto.blainemalone.com' : 'http://localhost:8787';

if (import.meta.env.VITE_PRODUCTION === 'true') {
    console.log("Communicating with server at: ", SERVER_URL);
} else {
    console.log("Using localhost: ", SERVER_URL);
}