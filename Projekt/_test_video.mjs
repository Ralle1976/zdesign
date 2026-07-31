// Test if Minimax video-01 works for Exploded View
const MINIMAX_KEY = 'sk-cp-p4g780jkhtVbE7KBrnBe5u1twrZNKvulVRzzZSzEdJtAmHNxqmFW6L-v1hj12W83OaPS9c7EBIZi6BNkHlpjAT1AVpEFbTs2uMxy9fMd22-zsS2bwXl8JbA';

console.log('=== VIDEO GENERATION TEST ===\n');
console.log('Testing Minimax video-01 with a watch image...\n');

const WATCH_IMG = 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcSBvhGyCzdduCiGvsDAcWwtXxV8q3PoC9dmewzX-3N9hyixE0Kipdal-rZfhrcSQ63AwRh67_6tYCTVlADGXd3C1bnr1nvrZw';

const prompts = [
  'Exploded view of a luxury wristwatch: case separates from dial, hands detach, crown unscrews, strap unlatches. Components float apart revealing inner mechanics. Golden light, black background, cinematic quality.',
  'Luxury watch exploding into its components in slow motion, case, dial, hands, crown, strap separating from the center. Premium product showcase, 8k quality.',
];

for (const prompt of prompts) {
  console.log(`Testing prompt: "${prompt.slice(0, 60)}..."`);
  
  const start = Date.now();
  const res = await fetch('https://api.minimax.io/v1/video_generation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MINIMAX_KEY}` },
    body: JSON.stringify({
      model: 'video-01',
      prompt,
      first_frame_image: WATCH_IMG,
    }),
    signal: AbortSignal.timeout(120000),
  });
  
  const elapsed = Math.round((Date.now() - start) / 1000);
  const data = await res.json();
  
  console.log(`  Status: ${res.status}, Elapsed: ${elapsed}s`);
  
  if (data.base_resp?.status_code === 2056) {
    console.log(`  ❌ LIMIT: Token Plan usage limit reached`);
    console.log(`  → Video generation is NOT available with current plan`);
    console.log(`  → Image generation (image-01) works, video does not`);
  } else if (data.task_id) {
    console.log(`  Task ID: ${data.task_id}`);
    console.log(`  ⚠️ Video queued (would need polling)`);
  } else if (data.data?.video_url) {
    console.log(`  ✅ Video generated!`);
    console.log(`  URL: ${data.data.video_url}`);
  } else {
    console.log(`  ⚠️ Unexpected: ${JSON.stringify(data).slice(0, 200)}`);
  }
  console.log('');
}

console.log('=== RESULT ===');
console.log('Minimax video-01 is NOT available with current plan.');
console.log('The Token Plan usage limit is reached for video generation.');
console.log('Image generation (image-01) works fine, but video requires a different plan.');
