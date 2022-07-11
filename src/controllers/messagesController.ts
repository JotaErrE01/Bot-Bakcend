import { PrismaClient } from "@prisma/client";
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

    if (!dataMessage) return res.status(200).json({ msg: 'No hay mensajes' });

    if(dataMessage.status === 'read'){
      // TODO: set the last message

      // TODO: create a new message
    }

    if (dataMessage.status) {
      return res.status(200).json({ msg: `Menssage ${dataMessage.status}` });
    }

    const { phoneId, from, text, messageId, name } = dataMessage;
    if(!phoneId || !from || !text || !messageId || !name){
      return res.status(200).json({ msg: 'No hay mensajes' });
    }

    // Mark as read the message
    await metaApi.post(`/${phoneId}/messages`, {
      "messaging_product": "whatsapp",
      "status": "read",
      "message_id": messageId,
    });

    // create prisma instance
    const { cliente, mensaje } = new PrismaClient();

    // verificar si el usuario existe
    const client = await cliente.findUnique({
      where: {
        whatsapp: from,
      }
    });

    // si no existe, crearlo
    if (!client) {
      await cliente.create({
        data: {
          whatsapp: from,
          nombre: name,
          updatedAt: new Date(),
          ultimaConversacionId: null,
          ultimoMensajeId: null,
        }
      });
    }

    let msg;

    if(!client?.ultimoMensajeId){
      msg = await mensaje.findUnique({
        where: {
          id: 1,
        }
      })
    }else{
      const msgs = await mensaje.findMany({
        where: {
          predecesorId: client?.ultimoMensajeId,
        }
      });
      console.log(msgs);

      msg = msgs.find(msg => msg.palabrasClave?.includes(text));
    }

    // actualizar el ultimo mensaje
    await cliente.update({
      where: {
        whatsapp: from,
      },
      data: {
        ultimoMensajeId: msg?.id,
        updatedAt: new Date(),
      }
    });

    const msgBot = msg?.cuerpo;

    let botMessageData;

    botMessageData = {
      "messaging_product": "whatsapp",
      "to": `${from}`,
      "type": "text",
      "text": {
        body: msgBot,
      },
    };

    const { data } = await metaApi.post(`/${phoneId}/messages?miIdPersonalizado=myCustomId`, botMessageData);
    console.log(data);
    return res.status(200).json(data);
  } catch (error) {
    // console.log(error);
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
