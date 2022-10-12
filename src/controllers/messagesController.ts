import { prisma } from "../db";
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

    if (dataMessage.status) {
      const { registroMensajeCliente } = prisma;
      const registroMessage = await registroMensajeCliente.findUnique({
        where: {
          whatsappMessageId: dataMessage.messageId,
        }
      });
      if(!registroMessage) return res.status(200).json({ msg: 'No hay mensajes' });
      if(registroMessage.leido) return res.status(200).json({ msg: 'Mensaje ya leido' });
      switch (dataMessage.status) {
        case 'delivered':
          await registroMensajeCliente.update({
            where: {
              whatsappMessageId: dataMessage.messageId,
            },
            data: {
              entregado: true,
            }
          });
          break;

        case 'read':
          await registroMensajeCliente.update({
            where: {
              whatsappMessageId: dataMessage.messageId,
            },
            data: {
              leido: true,
            }
          });
          break;
      
        default:
          break;
      }
      
      return res.status(200).json({ msg: `Menssage ${dataMessage.status}` });
    }

    const { phoneId, from, text, messageId, name } = dataMessage;
    if (!phoneId || !from || !text || !messageId || !name) {
      return res.status(200).json({ msg: 'No hay mensajes' });
    }

    // create prisma instance
    const { cliente, mensaje, mensajeLog } = prisma;

    // CONTROLAR QUE META NO ENVIE EL MISMO MENSAJE
    const message = await mensajeLog.findUnique({
      where: {
        mensajeId: messageId
      },
    });

    if (message) return res.status(200).json({ msg: 'No Modificated' });
    await mensajeLog.create({
      data: {
        mensajeId: messageId,
        recipentId: phoneId,
        status: 'delivered',
        updatedAt: new Date(),
      }
    })

    // Mark as read the message
    await metaApi.post(`/${phoneId}/messages`, {
      "messaging_product": "whatsapp",
      "status": "read",
      "message_id": messageId,
    });

    const botMessageData = {
      "messaging_product": "whatsapp",
      "to": `${from}`,
      "type": "text",
      "text": {
        body: 'Disculpas, no te tengo registrado en mi base de datos 😢',
      },
    };

    // verificar si el usuario existe
    let client = await cliente.findFirst({
      where: {
        whatsapp: from,
      }
    });

    // si no existe, TODO: enviar un mensaje de no tener registro del usuario o crearlo y asignarle una conversacion publica
    if (!client) {
      // cliente = await clientes.create({
      //   data: {
      //     whatsapp: from,
      //     nombre: name,
      //     apellido: '',
      //     updatedAt: new Date(),
      //     conversacionId: null,
      //     ultimoMensajeId: null,
      //   }
      // });

      // mensaje de no registrado en la base
      await metaApi.post(`/${phoneId}/messages`, botMessageData);
      return res.status(200).json({ msg: 'Mensaje enviado' });
    }

    let msg;

    // TODO: verificar si el usuario tiene una conversacion asignada
    if (!client.conversacionId) {
      botMessageData.text.body = 'Perdon, no tengo una conversacion asignada para ti 😢';
      await metaApi.post(`/${phoneId}/messages`, botMessageData);
      return res.status(200).json({ msg: 'Message Sent' });
      // const conversacion = await conversaciones.findFirst({
      //   where: {
      //     active: true,
      //   }
      // })

      // if(!conversacion){
      //   botMessageData.text.body = 'No hay conversaciones activas 🥲';
      //   await metaApi.post(`/${phoneId}/messages?miIdPersonalizado=myCustomId`, botMessageData);
      //   return res.status(200).json({ msg: 'No hay mensajes' });
      // }

      // // actualizar conversacion del cliente
      // await clientes.update({ where: { id: cliente.id }, data: { conversacionId: conversacion.id } });

      // // encontrar el mensaje principal
      // msg = await mensajes.findFirst({
      //   where: { conversacionId: conversacion.id, predecesorId: null }
      // });
    }
    // else {

    // Si no tiene un mensaje, buscar el mensaje principal
    if (!client.ultimoMensajeId) {
      msg = await mensaje.findFirst({
        where: { conversacionId: client.conversacionId, predecesorId: null }
      });
      botMessageData.text.body = msg!.cuerpo;

      if (!msg?.anyWord) {
        const palabrasClave = msg!.palabrasClave.split(',');
        const palabraClave = palabrasClave.find(palabra => palabra.toLowerCase() === text.toLowerCase());
        // si anyword es falso y no hay palabras clave, enviar un mensaje de no entendi
        if (!palabraClave) {
          botMessageData.text.body = 'Perdon, no entiendo tu mensaje 😢';
          await metaApi.post(`/${phoneId}/messages`, botMessageData);
          return res.status(200).json({ msg: 'Message Sent' });
        }
        // await metaApi.post(`/${phoneId}/messages`, botMessageData);
      } 
    } else {
      // Encuentra todos los hijos del ultimo mensaje
      const msgs = await mensaje.findMany({
        where: { conversacionId: client.conversacionId, predecesorId: client.ultimoMensajeId }
      });

      // Encuentra el mensaje a enviar por la palabra clave
      msg = msgs.find(({ palabrasClave }) => {
        const palabrasClaveArray = palabrasClave.split(',');
        return palabrasClaveArray.find(palabra => text.toLowerCase().includes(palabra.toLowerCase()));
      });

      // Si no encuentra el mensaje, enviar un mensaje de no entendi
      if (!msg) {
        botMessageData.text.body = 'Perdon, no entiendo tu mensaje 😢';
        await metaApi.post(`/${phoneId}/messages`, botMessageData);
        return res.status(200).json({ msg: 'Message Sent' });
      }
      // TODO: ver que hacer si no encuentra ningun mensaje hijo
    }

    // Actualizar ultimo mensaje del cliente
    await cliente.update({ where: { id: client.id }, data: { ultimoMensajeId: msg?.id } });

    // const msgBot = msg?.cuerpo;
    botMessageData.text.body = msg?.cuerpo!;

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
