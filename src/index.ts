/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler deploy src/index.ts --name my-worker` to deploy your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { DOPusher } from './DOPusher';

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
	DO_PUSHER: DurableObjectNamespace<DOPusher>
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		
		// const doPusher = env.DO_PUSHER.get(env.DO_PUSHER.idFromName("default"))
		// doPusher.fetch(request)
		// return new Response("Hello World!");


		if (request.url.indexOf("/YOUR_PUSHER_APP_KEY") > 0) {
			// Expect to receive a WebSocket Upgrade request.
			// If there is one, accept the request and return a WebSocket Response.
			const upgradeHeader = request.headers.get('Upgrade');
			if (!upgradeHeader || upgradeHeader !== 'websocket') {
			  return new Response('Durable Object expected Upgrade: websocket', { status: 426 });
			}
	  
			// This example will refer to the same Durable Object instance,
			// since the name "foo" is hardcoded.
			let id = env.DO_PUSHER.idFromName("default");
			let stub = env.DO_PUSHER.get(id);
	  
			return stub.fetch(request);
		  }
	  
		  return new Response(`
		  <script src="https://js.pusher.com/7.0/pusher.min.js"></script>
		  <script>


			const APP_KEY = 'YOUR_PUSHER_APP_KEY';
			const CLUSTER = 'YOUR_CLUSTER';
			const WORKER_URL = 'http://localhost:8787/connect';

			const pusher = new Pusher(APP_KEY, {
			cluster: CLUSTER,
			wsHost: 'localhost',
			wsPort: '8787',
			enabledTransports: ['ws'],
			forceTLS: false,
			disableStats: true,
			});
			const channel = pusher.subscribe('my-channel');
			channel.bind('new-message', function (data) {
				console.log(data);
			  });
			  channel.bind('client-a', function (data) {
				console.log(data);
			  });
			window.pusher = pusher
		//   const socket = new WebSocket('/websocket');

		// 	socket.onopen = () => {
		// 	console.log('Connected');
		// 	socket.send(JSON.stringify({}));
		// 	};
			
		// 	setInterval(()=> socket.send(JSON.stringify({ type: 'ping' })), 1000)
		// 	setInterval(()=> socket.send(JSON.stringify({})), 5000)

		// 	socket.onmessage = (event) => {
		// 	console.log('Message received:', event.data);
		// 	};

		// 	socket.onclose = () => {
		// 	console.log('Disconnected');
		// 	};
		  </script>`, {
			status: 200,
			headers: {
			  'Content-Type': 'text/html',
			},
		  });
	},
};

// export the custom DO classes
export { DOPusher } from './DOPusher';