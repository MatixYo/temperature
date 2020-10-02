import React, { useState } from 'react'
import { LineChart, Line, CartesianGrid, XAxis, YAxis } from "recharts"
import './App.css'

const serviceUUID = "226c0000-6476-4566-7562-66734470666d";
const characteristicUUID = "226caa55-6476-4566-7562-66734470666d";
const namePrefix = "MJ_HT_V1";

const getTw = (T, H) => T * Math.atan(0.151977 * (H + 8.313659)**(1/2)) + Math.atan(T + H) - Math.atan(H - 1.676331) + 0.00391838 * H**(3/2) * Math.atan(0.023101 * H) - 4.686035;

const App = () => {
	const [data, setData] = useState([{time: NaN, T: NaN, H: NaN, Tw: NaN}]);
	const [status, setStatus] = useState("disconnected");

	const onCharacteristicChange = e => {
		const { value } = e.target;
		const message = new TextDecoder().decode(value).slice(0, -1);
		const entries = message.split(" ").map(param => param.split("="));
		const params = Object.fromEntries(entries);
		const time = Date.now();
		const T = parseFloat(params.T);
		const H = parseFloat(params.H);
		const Tw = Math.round(getTw(T, H) * 10) / 10;
		setData(data => ([...data, {time, T, H, Tw}]));
	}

	let device, characteristic;

	async function onClick() {
		try {
			if(!device) {
				await requestDevice();
			}
			setStatus("connecting...");
			await connectDeviceAndCacheCharacteristics();
		} catch(e) {
			console.error(e)
		}
	}

	async function requestDevice() {
		device = await navigator.bluetooth.requestDevice({
			filters: [{ namePrefix }],
			optionalServices: [serviceUUID]
		});
		device.addEventListener('gattserverdisconnected', onDisconnected);
	}

	async function connectDeviceAndCacheCharacteristics() {
		if (device.gatt.connected && characteristic !== "") {
			return;
		}

		const server = await device.gatt.connect();
		setStatus("connected");

		const service = await server.getPrimaryService(serviceUUID);
		characteristic = await service.getCharacteristic(characteristicUUID);

		characteristic.addEventListener('characteristicvaluechanged', onCharacteristicChange);
		characteristic.startNotifications();
	}

	async function onDisconnected() {
		try {
			setStatus("disconnected");
			await connectDeviceAndCacheCharacteristics()
		} catch(error) {
			console.log('Argh! ' + error);
		}
	}

	const {time, T, H, Tw} = data[data.length - 1];

	return (
		<div>
			<div className="App">
				<button onClick={onClick}>Scan for {namePrefix}</button>
				{!isNaN(time) && <>
					<div style={{fontSize: 100, fontStyle: "light", fontFamily: "Segoe UI"}}>{T} C</div>
					<div style={{fontSize: 100, fontStyle: "light", fontFamily: "Segoe UI"}}>{H}%</div>
					<div style={{fontSize: 80, fontStyle: "light", fontFamily: "Segoe UI"}}>{Tw} C</div>
					<div>Updated {time}</div>
				</>}
				<p>{status}</p>
				<LineChart width={600} height={300} data={data} style={{margin: "auto"}}>
					<Line type="monotone" dataKey="T" stroke={"#4a3bf6"} />
					<Line type="monotone" dataKey="H" stroke={"#2eaa5c"} />
					<Line type="monotone" dataKey="Tw" stroke={"#c94040"} />
					<CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
					<XAxis dataKey="time" />
					<YAxis />
				</LineChart>
			</div>
		</div>
	);
}

export default App;
