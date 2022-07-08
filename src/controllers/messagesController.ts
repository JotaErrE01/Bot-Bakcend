import { Request, Response } from "express";
import { metaApi } from "../api";
import { Messages } from "../utils";

// funcion para validar el token con meta
export const validarWebHookToken = (req: Request, res: Response) => {
  if (req.query['hub.verify_token'] === process.env.PERSONAL_ACCESS_TOKEN) {
    res.status(200).send(req.query['hub.challenge']);
  } else {
    res.status(401).json({ msg: 'Access Denied' });
  }
}

// funcion para controlar los mensajes de whatsapp
export const messagesController = async (req: Request, res: Response) => {
  try {
    const dataMessage = await Messages.getDataMessage(req.body);

    if(dataMessage === 'delivered' || dataMessage === 'read' || dataMessage === 'sent'){
      return res.status(200).send();
    }

    if (!dataMessage) return res.status(200).json({ msg: 'No hay mensajes' });

    const { phoneId, recipentWaId, text } = dataMessage;

    let botMessageData;

    botMessageData = {
      "messaging_product": "whatsapp",
      "to": `${recipentWaId}`,
      "type": "text",
      "text": { body: '*Hola Mundo* 😄' },
      // "template": {
      //   "name": "hello_world",
      //   "language": {
      //     "code": "en_US"
      //   }
      // }
    }

    // if( text?.toLocaleLowerCase().trim().includes('hola') ) {
    //   dataToPost = {
    //     "messaging_product": "whatsapp",
    //     "to": `${recipentWaId}`,
    //     "type": "text",
    //     "text": { body: 'Hola 😃 que tal, Soy tu asistente virtual 🤖 \n\n ¿Qué deseas hacer? \n\n\n 1️⃣ Radicar una solicitud de soporte \n\n 2️⃣ Consultar el estado de una solicitud \n\n 3️⃣ Gestionar una solicitud radicada \n\n 4️⃣ Conocer Jira \n\n Elije el número de la opción para iniciar la consulta 👇' },
    // }
    
    const { data } = await metaApi.post(`/${phoneId}/messages`, botMessageData);
    return res.status(200).json(data);
  } catch (error) {
    console.log(error);
    res.status(400).json({ msg: 'Error' });
  }
}

// async function callSendAPI(messageData: any, phoneNumber: any) {
//   try {
//     const { data } = await whatsAppAPI.createAxiosInstance().post(`/${phoneNumber}/messages`, messageData);
//     console.log('success', data);
//   } catch (error) {
//     console.log(error);
//   }
// }
