// Template for an image-generation provider (ignored by the loader because of the leading "_").
// Copy to <name>.mjs, fill in the API call, set `tested: true` ONLY after you ran it against the real service.
export default {
  id: 'my-service',
  label: 'اسم الخدمة',
  envKey: 'MY_SERVICE_API_KEY',
  tested: false,
  configured: () => !!process.env.MY_SERVICE_API_KEY,
  // prompt: Arabic prompt, promptEn: English prompt, aspect: '1:1' | '4:5' | '9:16'
  async generate({ prompt, promptEn, aspect }) {
    // const res = await fetch('https://…', { headers: { Authorization: `Bearer ${process.env.MY_SERVICE_API_KEY}` }, body: … });
    // return Buffer.from(await res.arrayBuffer());       // or { buffer, ext: '.jpg' }
    throw new Error('not implemented');
  },
};
