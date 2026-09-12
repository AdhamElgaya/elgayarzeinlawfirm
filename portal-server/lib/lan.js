import os from "os";

export function lanIPv4s() {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      if (net.family !== "IPv4" || net.internal) continue;
      if (net.address.startsWith("169.254.")) continue;
      addresses.push(net.address);
    }
  }
  return addresses.sort((a, b) => {
    const score = (ip) =>
      ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : ip.startsWith("172.") ? 2 : 3;
    return score(a) - score(b);
  });
}
