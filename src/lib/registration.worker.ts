// Work runs off the UI thread. The server independently checks the result and consumes the challenge.
self.onmessage=async(event:MessageEvent<{id:string;difficulty:number}>)=>{
  const {id,difficulty}=event.data;
  const encoder=new TextEncoder();
  try {
    for(let nonce=0;nonce<2_000_000;nonce++) {
      const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(`${id}:${nonce}`)));
      const hex=Array.from(digest,byte=>byte.toString(16).padStart(2,'0')).join('');
      if(hex.startsWith('0'.repeat(difficulty))) {self.postMessage({nonce});return;}
    }
    self.postMessage({error:'Security check timed out. Please try again.'});
  } catch {self.postMessage({error:'Security check is unavailable in this browser. Try an updated browser.'});}
};
