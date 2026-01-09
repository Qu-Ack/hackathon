import {io} from "socket.io-client"

const URL = "http://20.193.158.43:3000";

export const socket = io(URL);

