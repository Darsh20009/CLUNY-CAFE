import fetch from 'node-fetch';

async function testFiltering() {
  console.log('\n🧪 TESTING FRONTEND FILTERING\n');
  
  try {
    // Get branches
    console.log('📋 Getting branches...');
    const branchesRes = await fetch('https://cluny.ma3k.online/api/branches');
    const branches = await branchesRes.json();
    
    console.log(`Found ${branches.length} branches:\n`);
    branches.forEach(b => console.log(`  - ${b.nameAr} (ID: ${b._id})`));
    
    // Test each branch
    for (const branch of branches.slice(0, 3)) {
      console.log(`\n📊 Testing branch: ${branch.nameAr}`);
      
      const url = `https://cluny.ma3k.online/api/tables?branchId=${branch._id}`;
      const tablesRes = await fetch(url);
      const tables = await tablesRes.json();
      
      console.log(`  ✓ Tables for this branch: ${tables.length}`);
      if (tables.length > 0) {
        const tableNumbers = tables.map(t => t.tableNumber).sort((a,b) => parseInt(a) - parseInt(b));
        console.log(`  ✓ Table numbers: ${tableNumbers.join(', ')}`);
      }
      
      if (tables.length > 10) {
        console.log(`  ❌ ERROR: Should be <= 10 tables, got ${tables.length}`);
      }
    }
    
    // Test without branchId (should get all)
    console.log('\n📊 Testing without branchId (should get all):');
    const allRes = await fetch('https://cluny.ma3k.online/api/tables');
    const allTables = await allRes.json();
    console.log(`  ✓ Total tables: ${allTables.length}`);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testFiltering();
