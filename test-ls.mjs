#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Start the language server
const serverPath = join(__dirname, 'packages/language-server/bin/wc-language-server.js');
const ls = spawn('node', [serverPath, '--stdio'], {
  cwd: join(__dirname, 'demos/html'),
  stdio: ['pipe', 'pipe', 'inherit']
});

let messageId = 1;
let buffer = '';

// Helper to send JSON-RPC message
function sendMessage(method, params) {
  const id = messageId++;
  const message = JSON.stringify({
    jsonrpc: '2.0',
    id,
    method,
    params
  });
  const content = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`;
  console.log('>>> Sending:', method);
  ls.stdin.write(content);
  return id;
}

// Parse incoming messages
ls.stdout.on('data', (data) => {
  buffer += data.toString();
  
  while (true) {
    const headerMatch = buffer.match(/Content-Length: (\d+)\r\n\r\n/);
    if (!headerMatch) break;
    
    const contentLength = parseInt(headerMatch[1]);
    const messageStart = buffer.indexOf('\r\n\r\n') + 4;
    
    if (buffer.length < messageStart + contentLength) break;
    
    const messageContent = buffer.substring(messageStart, messageStart + contentLength);
    buffer = buffer.substring(messageStart + contentLength);
    
    try {
      const message = JSON.parse(messageContent);
      console.log('<<< Received:', message.method || `response to id ${message.id}`);
      
      if (message.result && message.id === 2) {
        console.log('\n✅ Initialize successful!');
        console.log('Server capabilities:', JSON.stringify(message.result.capabilities, null, 2));
        
        // Send initialized notification
        const initMessage = JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialized',
          params: {}
        });
        const initContent = `Content-Length: ${Buffer.byteLength(initMessage)}\r\n\r\n${initMessage}`;
        ls.stdin.write(initContent);
        
        // Wait a bit then request docs
        setTimeout(() => {
          console.log('\n📚 Requesting component docs...');
          sendMessage('wctools/getDocs', {});
        }, 1000);
      }
      
      if (message.result && message.id === 3) {
        console.log('\n✅ Got docs response!');
        const docs = message.result;
        const componentNames = Object.keys(docs);
        console.log(`Found ${componentNames.length} components:`, componentNames.slice(0, 10).join(', '));
        
        // Success! Exit
        setTimeout(() => {
          ls.stdin.end();
          process.exit(0);
        }, 100);
      }
    } catch (e) {
      console.error('Failed to parse message:', e);
    }
  }
});

ls.on('close', (code) => {
  console.log(`Language server exited with code ${code}`);
});

// Initialize the language server
setTimeout(() => {
  sendMessage('initialize', {
    processId: process.pid,
    rootUri: `file://${join(__dirname, 'demos/html')}`,
    capabilities: {}
  });
}, 100);
