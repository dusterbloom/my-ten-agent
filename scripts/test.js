#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 TEN Agent Test Suite');
console.log('======================\n');

const tests = [
    {
        name: 'Node.js Version',
        command: 'node',
        args: ['--version'],
        expected: /v16\./
    },
    {
        name: 'Python 3',
        command: 'python3',
        args: ['--version'],
        expected: /Python 3\./
    },
    {
        name: 'Ollama Service',
        command: 'curl',
        args: ['-s', 'http://localhost:11434/api/tags'],
        expected: /models/
    },
    {
        name: 'LiveKit Server',
        command: 'curl',
        args: ['-s', 'http://localhost:7880'],
        expected: /LiveKit/
    },
    {
        name: 'Whisper Library',
        command: 'python3',
        args: ['-c', 'import whisper; print("Whisper OK")'],
        expected: /Whisper OK/
    },
    {
        name: 'Piper TTS',
        command: 'piper',
        args: ['--help'],
        expected: /usage/
    }
];

let passed = 0;
let failed = 0;

async function runTest(test) {
    return new Promise((resolve) => {
        console.log(`Testing ${test.name}...`);
        
        const child = spawn(test.command, test.args, { stdio: 'pipe' });
        let output = '';
        
        child.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            output += data.toString();
        });
        
        child.on('close', (code) => {
            if (test.expected.test(output)) {
                console.log(`✅ ${test.name}: PASSED`);
                passed++;
            } else {
                console.log(`❌ ${test.name}: FAILED`);
                console.log(`   Output: ${output.trim()}`);
                failed++;
            }
            resolve();
        });
        
        child.on('error', (error) => {
            console.log(`❌ ${test.name}: ERROR - ${error.message}`);
            failed++;
            resolve();
        });
    });
}

async function runAllTests() {
    console.log('Running system checks...\n');
    
    for (const test of tests) {
        await runTest(test);
    }
    
    console.log('\n' + '='.repeat(30));
    console.log(`Test Results: ${passed} passed, ${failed} failed`);
    
    if (failed > 0) {
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Run: npm run setup');
        console.log('2. Check services are running:');
        console.log('   - Ollama: ollama serve');
        console.log('   - LiveKit: livekit-server --dev');
        console.log('3. Install missing dependencies');
        process.exit(1);
    } else {
        console.log('\n🎉 All tests passed! Ready to start TEN Agent.');
        console.log('Run: npm start');
    }
}

// Check if required directories exist
const requiredDirs = ['uploads', 'logs', 'extensions'];
requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
    }
});

// Run tests
runAllTests().catch(console.error);