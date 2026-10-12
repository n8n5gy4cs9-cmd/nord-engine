import { NordScript } from 'nord';
export default class Zone extends NordScript {
  onTriggerEnter(other) { window.__zoneEnter = (window.__zoneEnter ?? 0) + 1; }
}
