// Auto-reconnecting WebSocket client.
// Events are dispatched to registered handlers by op code.
export class Gateway {
  constructor(token) {
    this.token = token;
    this.handlers = {};
    this.ws = null;
    this.retryDelay = 1000;
    this.closedByUs = false;
  }

  on(op, fn) {
    (this.handlers[op] ||= []).push(fn);
    return this;
  }

  connect() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    this.ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(this.token)}`);

    this.ws.onopen = () => {
      this.retryDelay = 1000;
      for (const fn of this.handlers["CONNECTED"] || []) fn();
    };

    this.ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      for (const fn of this.handlers[msg.op] || []) fn(msg.data);
    };

    this.ws.onclose = () => {
      if (this.closedByUs) return;
      // Exponential backoff reconnect, capped at 15s
      setTimeout(() => {
        if (!this.closedByUs) this.connect();
      }, this.retryDelay);
      this.retryDelay = Math.min(this.retryDelay * 2, 15000);
    };
  }

  subscribe(channelId) {
    this.send({ op: "SUBSCRIBE", channel_id: channelId });
  }

  unsubscribe(channelId) {
    this.send({ op: "UNSUBSCRIBE", channel_id: channelId });
  }

  typing(channelId) {
    this.send({ op: "TYPING", channel_id: channelId });
  }

  send(obj) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  close() {
    this.closedByUs = true;
    this.ws?.close();
  }
}
