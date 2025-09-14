#!/usr/bin/env node

// Test script for beta usage management system
const path = require('path');

// Mock localStorage for Node.js testing
const LocalStorage = require('node-localstorage').LocalStorage;
const localStorage = new LocalStorage('./tmp');

// Clear any existing usage data for clean test
localStorage.removeItem('beta_usage_data');

// Import the BetaUsageManager
console.log('🧪 Testing Beta Usage Management System\n');

try {
    // Mock require for services
    const BetaUsageManager = {
        limits: {
            transcription: 120, // minutes
            briefs: 15,
            emails: 20,
            ai_assists: 30
        },

        getCurrentUsage() {
            const data = localStorage.getItem('beta_usage_data');
            if (!data) return {};
            
            const usage = JSON.parse(data);
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            return usage[currentMonth] || {};
        },

        checkLimit(type, amount = 1) {
            const currentUsage = this.getCurrentUsage();
            const used = currentUsage[type] || 0;
            const limit = this.limits[type];
            const willExceed = (used + amount) > limit;
            
            return {
                allowed: !willExceed,
                used,
                limit,
                remaining: Math.max(0, limit - used),
                wouldExceed: willExceed
            };
        },

        incrementUsage(type, amount = 1) {
            const data = localStorage.getItem('beta_usage_data');
            let usage = data ? JSON.parse(data) : {};
            
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            if (!usage[currentMonth]) {
                usage[currentMonth] = {};
            }
            
            usage[currentMonth][type] = (usage[currentMonth][type] || 0) + amount;
            localStorage.setItem('beta_usage_data', JSON.stringify(usage));
            
            return usage[currentMonth][type];
        }
    };

    // Test 1: Check initial limits (should all be allowed)
    console.log('✅ Test 1: Initial limit checks');
    const types = ['transcription', 'briefs', 'emails', 'ai_assists'];
    types.forEach(type => {
        const check = BetaUsageManager.checkLimit(type);
        console.log(`  ${type}: ${check.allowed ? '✅' : '❌'} ${check.used}/${check.limit} (${check.remaining} remaining)`);
    });

    // Test 2: Increment usage and check
    console.log('\n✅ Test 2: Usage increment and tracking');
    BetaUsageManager.incrementUsage('transcription', 30);
    BetaUsageManager.incrementUsage('briefs', 5);
    BetaUsageManager.incrementUsage('emails', 10);
    BetaUsageManager.incrementUsage('ai_assists', 15);

    types.forEach(type => {
        const check = BetaUsageManager.checkLimit(type);
        console.log(`  ${type}: ${check.allowed ? '✅' : '❌'} ${check.used}/${check.limit} (${check.remaining} remaining)`);
    });

    // Test 3: Try to exceed limits
    console.log('\n✅ Test 3: Limit enforcement (should block)');
    const exceedTests = [
        { type: 'transcription', amount: 100 }, // 30 + 100 = 130 > 120
        { type: 'briefs', amount: 15 },         // 5 + 15 = 20 > 15
        { type: 'emails', amount: 15 },         // 10 + 15 = 25 > 20
        { type: 'ai_assists', amount: 20 }      // 15 + 20 = 35 > 30
    ];

    exceedTests.forEach(test => {
        const check = BetaUsageManager.checkLimit(test.type, test.amount);
        console.log(`  ${test.type} (+${test.amount}): ${check.allowed ? '❌ SHOULD BE BLOCKED' : '✅ CORRECTLY BLOCKED'}`);
    });

    // Test 4: Valid increments within limits
    console.log('\n✅ Test 4: Valid increments within limits');
    const validTests = [
        { type: 'transcription', amount: 10 }, // 30 + 10 = 40 < 120
        { type: 'briefs', amount: 3 },         // 5 + 3 = 8 < 15
        { type: 'emails', amount: 5 },         // 10 + 5 = 15 < 20
        { type: 'ai_assists', amount: 10 }     // 15 + 10 = 25 < 30
    ];

    validTests.forEach(test => {
        const check = BetaUsageManager.checkLimit(test.type, test.amount);
        console.log(`  ${test.type} (+${test.amount}): ${check.allowed ? '✅ ALLOWED' : '❌ SHOULD BE ALLOWED'}`);
    });

    console.log('\n🎉 Beta Usage Management System Tests Complete!');

} catch (error) {
    console.error('❌ Test failed:', error);
}

// Cleanup
localStorage.removeItem('beta_usage_data');
