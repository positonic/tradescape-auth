#!/usr/bin/env bun
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Test query
    const count = await prisma.position.count({
      where: {
        positionType: 'automated'
      }
    });
    console.log(`📊 Found ${count} automated positions`);
    
    await prisma.$disconnect();
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

testConnection();