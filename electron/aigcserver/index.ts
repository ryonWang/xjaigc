import {ServerCosyvoice} from "./server-cosyvoice";
import {ServerCosyvoice205b} from "./server-cosyvoice2-0.5b";
import {ServerCosyvoice2300mInstruct} from "./server-cosyvoice2-300m-instruct";
import {EasyServer} from "./EasyServer";
import {ServerLive} from "./server-live";


export const AigcServer = {
    'EasyServer': EasyServer,
    'server-live': ServerLive,
    'server-cosyvoice': ServerCosyvoice,
    'server-cosyvoice2-0.5b': ServerCosyvoice205b,
    'server-cosyvoice2-300m-instruct': ServerCosyvoice2300mInstruct,
}
