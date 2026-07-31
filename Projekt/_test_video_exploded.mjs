// Test Minimax video-01 for Exploded View generation
const MINIMAX_KEY = 'sk-cp-p4g780jkhtVbE7KBrnBe5u1twrZNKvulVRzzZSzEdJtAmHNxqmFW6L-v1hj12W83OaPS9c7EBIZi6BNkHlpjAT1AVpEFbTs2uMxy9fMd22-zsS2bwXl8JbA';
const WATCH_IMG = 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcSBvhGyCzdduCiGvsDAcWwtXxV8q3PoC9dmewzX-3N9hyixE0Kipdal-rZfhrcSQ63AwRh67_6tYCTVlADGXd3C1bnr1nvrZw';

console.log('=== MINIMAX VIDEO-01 EXPLODED VIEW TEST ===\n');
console.log('Input image:', WATCH_IMG.slice(0, 80));
console.log('Prompt: Exploded view of luxury watch components separating...');

const start = Date.now();
const res = await fetch('https://api.minimax.io/v1/video_generation', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MINIMAX_KEY}` },
  body: JSON.stringify({
    model: 'video-01',
    prompt: 'Slow cinematic exploded view of a luxury wristwatch: the case separates from the dial, the hands detach, the crown unscrews, the strap unlatches. Each component floats apart revealing the intricate inner mechanics. Golden light, black background, premium product showcase, 8k cinematic quality',
    first_frame_image: WATCH_IMG,
  }),
  signal: AbortSignal.timeout(120000),
});
const elapsed = Math.round((Date.now() - start) / 1000);

console.log(`\nStatus: ${res.status}, Elapsed: ${elapsed}s`);

const data = await res.json();
console.log('Response keys:', Object.keys(data));

if (data.task_id) {
  console.log('Task ID:', data.task_id);
  console.log('Status:', data.status || 'pending');
  
  // Poll for completion
  if (data.task_id) {
    console.log('\nPolling for video completion...');
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const statusRes = await fetch(`https://api.minimax.io/v1/video_generation/${data.task_id}`, {
        headers: { Authorization: `Bearer ${MINIMAX_KEY}` },
      });
      const statusData = await statusRes.json();
      console.log(`  [${i}] Status: ${statusData.status}, URL: ${statusData.video_url ? '✅' : 'pending'}`);
      
      if (statusData.status === 'succeeded' && statusData.video_url) {
        console.log('\n✅ VIDEO GENERATED!');
        console.log('Video URL:', statusData.video_url);
        break;
      }
      if (statusData.status === 'failed') {
        console.log('\n❌ Video generation failed:', statusData.error);
        break;
      }
    }
  }
} else if (data.data?.video_url) {
  console.log('\n✅ VIDEO GENERATED (direct)!');
  console.log('Video URL:', data.data.video_url);
} else {
  console.log('\n⚠️ Unexpected response:', JSON.stringify(data, null, 2).slice(0, 500));
}
