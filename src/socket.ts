import {io} from "socket.io-client"

const URL = "http://192.168.1.12:3000";

export const socket = io(URL);
