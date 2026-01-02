/**
 * Analyze Training Data
 * 
 * This script analyzes the training data collected from Chart Learning Mode
 * and suggests improvements to the algorithm.
 */

import fs from 'fs';

const TRAINING_FILE = './training/training-data.json';

function analyzeTraining() {
  console.log('📊 Analyzing Training Data...\n');
  
  if (!fs.existsSync(TRAINING_FILE)) {
    console.log('❌ No training data found.');
    console.log('   Run the script with CHART_LEARNING=true first:\n');
    console.log('   $env:CHART_LEARNING="true"; npm start\n');
    return;
  }
  
  const trainingData = JSON.parse(fs.readFileSync(TRAINING_FILE));
  
  console.log(`📁 Found ${trainingData.length} training sessions\n`);
  
  if (trainingData.length === 0) {
    console.log('⚠️  No training data to analyze.\n');
    return;
  }
  
  // Separate accepted vs corrected
  const accepted = trainingData.filter(entry => !entry.userCorrections);
  const corrected = trainingData.filter(entry => entry.userCorrections);
  
  console.log(`✅ Accepted (no corrections): ${accepted.length}`);
  console.log(`📝 Corrected: ${corrected.length}\n`);
  
  if (corrected.length === 0) {
    console.log('🎉 Great! Algorithm is 100% accurate (no corrections needed)\n');
    return;
  }
  
  // Analyze corrections
  let firstXTotal = 0, firstYTotal = 0;
  let lastXTotal = 0, lastYTotal = 0;
  let firstCount = 0, lastCount = 0;
  
  corrected.forEach(entry => {
    if (entry.userCorrections.first) {
      const diffX = entry.userCorrections.first.svgX - entry.algorithmDetection.first.svgX;
      const diffY = entry.userCorrections.first.svgY - entry.algorithmDetection.first.svgY;
      firstXTotal += diffX;
      firstYTotal += diffY;
      firstCount++;
    }
    
    if (entry.userCorrections.last) {
      const diffX = entry.userCorrections.last.svgX - entry.algorithmDetection.last.svgX;
      const diffY = entry.userCorrections.last.svgY - entry.algorithmDetection.last.svgY;
      lastXTotal += diffX;
      lastYTotal += diffY;
      lastCount++;
    }
  });
  
  console.log('═'.repeat(60));
  console.log('📈 ANALYSIS RESULTS');
  console.log('═'.repeat(60));
  
  if (firstCount > 0) {
    const avgFirstX = firstXTotal / firstCount;
    const avgFirstY = firstYTotal / firstCount;
    
    console.log('\n🟢 FIRST Point Corrections:');
    console.log(`   Average X offset: ${avgFirstX > 0 ? '+' : ''}${avgFirstX.toFixed(1)}px`);
    console.log(`   Average Y offset: ${avgFirstY > 0 ? '+' : ''}${avgFirstY.toFixed(1)}px`);
    console.log(`   Based on ${firstCount} corrections`);
    
    if (Math.abs(avgFirstX) > 5 || Math.abs(avgFirstY) > 5) {
      console.log('\n   ⚠️  Significant systematic bias detected!');
      console.log('   💡 Recommendation: Adjust algorithm');
    }
  }
  
  if (lastCount > 0) {
    const avgLastX = lastXTotal / lastCount;
    const avgLastY = lastYTotal / lastCount;
    
    console.log('\n🔴 LAST Point Corrections:');
    console.log(`   Average X offset: ${avgLastX > 0 ? '+' : ''}${avgLastX.toFixed(1)}px`);
    console.log(`   Average Y offset: ${avgLastY > 0 ? '+' : ''}${avgLastY.toFixed(1)}px`);
    console.log(`   Based on ${lastCount} corrections`);
    
    if (Math.abs(avgLastX) > 5 || Math.abs(avgLastY) > 5) {
      console.log('\n   ⚠️  Significant systematic bias detected!');
      console.log('   💡 Recommendation: Adjust algorithm');
    }
  }
  
  // Accuracy calculation
  const accuracy = (accepted.length / trainingData.length * 100).toFixed(1);
  console.log('\n📊 Overall Accuracy:');
  console.log(`   ${accuracy}% of detections accepted without corrections`);
  console.log(`   (${accepted.length}/${trainingData.length} sessions)\n`);
  
  if (accuracy < 80) {
    console.log('⚠️  Accuracy below 80% - Algorithm needs improvement');
  } else if (accuracy < 95) {
    console.log('👍 Good accuracy, but room for improvement');
  } else {
    console.log('🎉 Excellent accuracy!');
  }
  
  console.log('\n═'.repeat(60));
  console.log('🔧 SUGGESTED CODE ADJUSTMENTS');
  console.log('═'.repeat(60));
  
  if (firstCount > 0) {
    const avgFirstX = firstXTotal / firstCount;
    const avgFirstY = firstYTotal / firstCount;
    
    if (Math.abs(avgFirstX) > 3 || Math.abs(avgFirstY) > 3) {
      console.log('\nFor FIRST point detection, add this adjustment:');
      console.log('```javascript');
      console.log('// In irrigation-playwright.js, after detecting firstPoint:');
      console.log(`firstPoint.x += ${avgFirstX.toFixed(1)}; // User correction offset`);
      console.log(`firstPoint.y += ${avgFirstY.toFixed(1)}; // User correction offset`);
      console.log('```\n');
    }
  }
  
  if (lastCount > 0) {
    const avgLastX = lastXTotal / lastCount;
    const avgLastY = lastYTotal / lastCount;
    
    if (Math.abs(avgLastX) > 3 || Math.abs(avgLastY) > 3) {
      console.log('\nFor LAST point detection, add this adjustment:');
      console.log('```javascript');
      console.log('// In irrigation-playwright.js, after detecting lastPoint:');
      console.log(`lastPoint.x += ${avgLastX.toFixed(1)}; // User correction offset`);
      console.log(`lastPoint.y += ${avgLastY.toFixed(1)}; // User correction offset`);
      console.log('```\n');
    }
  }
  
  console.log('\n📚 Training Data Details:');
  console.log(`   File: ${TRAINING_FILE}`);
  console.log(`   Total sessions: ${trainingData.length}`);
  console.log(`   To collect more: $env:CHART_LEARNING="true"; npm start\n`);
}

// Run analysis
analyzeTraining();

