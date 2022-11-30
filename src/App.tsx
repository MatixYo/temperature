import React, { useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import "./App.css";

const SERVICE_UUID = "226c0000-6476-4566-7562-66734470666d";
const CHARACTERISTIC_UUID = "226caa55-6476-4566-7562-66734470666d";
const NAME_PREFIX = "MJ_HT_V1";

type Humidity = number;
type TemperatureCelsius = number;

enum Status {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting...",
  CONNECTED = "connected",
}

type LogEntry = {
  time: number;
  T: TemperatureCelsius;
  H: Humidity;
  Tw: TemperatureCelsius;
};

type LogProperties = keyof LogEntry;

const LINE_COLORS: Record<LogProperties, string> = {
  time: "transparent", // TODO remove entirely
  T: "#4a3bf6",
  H: "#2eaa5c",
  Tw: "#c94040",
};

const getTw = (T: TemperatureCelsius, H: Humidity): TemperatureCelsius =>
  T * Math.atan(0.151977 * (H + 8.313659) ** (1 / 2)) +
  Math.atan(T + H) -
  Math.atan(H - 1.676331) +
  0.00391838 * H ** (3 / 2) * Math.atan(0.023101 * H) -
  4.686035;

const App = () => {
  const [data, setData] = useState<Array<LogEntry>>([
    { time: NaN, T: NaN, H: NaN, Tw: NaN },
  ]);
  const [status, setStatus] = useState<Status>(Status.DISCONNECTED);

  const onCharacteristicChange = (e: Event) => {
    if (!e.target) return;
    const value = (e.target as unknown as { value: BufferSource }).value;
    const message = new TextDecoder().decode(value).slice(0, -1);
    const entries = message.split(" ").map((param) => param.split("="));
    const params = Object.fromEntries(entries);
    const time = Date.now();
    const T = parseFloat(params.T);
    const H = parseFloat(params.H);
    const Tw = Math.round(getTw(T, H) * 10) / 10;
    setData((data) => [...data, { time, T, H, Tw }]);
  };

  let device: BluetoothDevice,
    characteristic: BluetoothRemoteGATTCharacteristic;

  async function onClick() {
    try {
      if (!device) {
        await requestDevice();
      }
      setStatus(Status.CONNECTING);
      await connectDeviceAndCacheCharacteristics();
    } catch (e) {
      console.error(e);
    }
  }

  async function requestDevice() {
    device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: NAME_PREFIX }],
      optionalServices: [SERVICE_UUID],
    });
    device.addEventListener("gattserverdisconnected", onDisconnected);
  }

  async function connectDeviceAndCacheCharacteristics() {
    if (!device.gatt || (device.gatt.connected && characteristic)) {
      return;
    }

    const server = await device.gatt.connect();
    setStatus(Status.CONNECTED);

    const service = await server.getPrimaryService(SERVICE_UUID);
    characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

    characteristic.addEventListener(
      "characteristicvaluechanged",
      onCharacteristicChange
    );
    await characteristic.startNotifications();
  }

  async function onDisconnected() {
    try {
      setStatus(Status.DISCONNECTED);
      await connectDeviceAndCacheCharacteristics();
    } catch (error) {
      console.error("Argh! " + error);
    }
  }

  const { time, T, H, Tw } = data[data.length - 1];

  return (
    <div>
      <div className="App">
        <button onClick={onClick}>Scan for {NAME_PREFIX}</button>
        {!isNaN(time) && (
          <>
            <div
              style={{
                fontSize: 100,
                fontStyle: "light",
                fontFamily: "Segoe UI",
              }}
            >
              {T} C
            </div>
            <div
              style={{
                fontSize: 100,
                fontStyle: "light",
                fontFamily: "Segoe UI",
              }}
            >
              {H}%
            </div>
            <div
              style={{
                fontSize: 80,
                fontStyle: "light",
                fontFamily: "Segoe UI",
              }}
            >
              {Tw} C
            </div>
            <div>Updated at {time}</div>
          </>
        )}
        <p>{status}</p>
        <LineChart
          width={600}
          height={300}
          data={data}
          style={{ margin: "auto" }}
        >
          {Object.entries(LINE_COLORS).map(([key, color]) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={color as string}
            />
          ))}
          <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
          <XAxis dataKey="time" />
          <YAxis />
        </LineChart>
      </div>
    </div>
  );
};

export default App;
