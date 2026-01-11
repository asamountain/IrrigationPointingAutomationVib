# Read network-interceptor.js
with open('network-interceptor.js', 'r') as f:
    content = f.read()

# Find the section that looks for sensor keys
old_sensor_logic = '''  // Look for sensor keys (slabwgt, slabvwc, etc.)
  if (nodeData.length === 0) {
    console.log('⚠️  [NETWORK] Node data array is empty');
    return null;
  }
  
  const firstEntry = nodeData[0];
  const sensorKeys = Object.keys(firstEntry).filter(k => 
    k.toLowerCase().includes('slab') || 
    k.toLowerCase().includes('wgt') || 
    k.toLowerCase().includes('vwc')
  );'''

new_sensor_logic = '''  // Look for sensor keys (slabwgt, slabvwc, etc.)
  if (nodeData.length === 0) {
    console.log('⚠️  [NETWORK] Node data array is empty');
    return null;
  }
  
  // Find first non-empty entry (skip empty objects at the start)
  let firstEntry = null;
  for (let i = 0; i < Math.min(10, nodeData.length); i++) {
    if (nodeData[i] && Object.keys(nodeData[i]).length > 1) { // More than just "timestamp"
      firstEntry = nodeData[i];
      if (i > 0) {
        console.log(`   → Skipped ${i} empty entries, using entry [${i}]`);
      }
      break;
    }
  }
  
  if (!firstEntry) {
    console.log('⚠️  [NETWORK] All entries are empty');
    return null;
  }
  
  // Look for sensor keys with flexible pattern matching (handles suffixes like "_1", "_2")
  const sensorKeys = Object.keys(firstEntry).filter(k => {
    const lower = k.toLowerCase();
    return (lower.includes('slabwgt') || 
            lower.includes('slabvwc') || 
            lower.includes('calslabvwc')) && 
           k !== 'timestamp';
  });'''

if old_sensor_logic in content:
    content = content.replace(old_sensor_logic, new_sensor_logic)
    
    with open('network-interceptor.js', 'w') as f:
        f.write(content)
    
    print("✅ FIXED: Sensor key parser now handles:")
    print("   1. Empty objects at the start of array")
    print("   2. Dynamic suffixes (slabwgt_1, slabwgt_2, etc.)")
    print("   3. Both slabwgt and calslabvwc keys")
else:
    print("❌ Could not find target section")
    print("   Will need manual inspection")

