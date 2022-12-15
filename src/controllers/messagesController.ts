import { Request, Response } from "express";
import { Server as SocketServer } from 'socket.io';
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import { App, Mensaje } from "@prisma/client";
import { formatVariables, Messages, getReqType, Templates } from "../utils";
import { MetaApi } from "../api";
import { prisma } from "../db";

// funcion para validar el token con meta
export const validarWebHookToken = async (req: Request, res: Response) => {
  const { app } = prisma;
  const token = req.query['hub.verify_token'];
  if (!token) return res.status(400).json({ msg: 'Token no encontrado' });
  const { webHookApi } = req.params;

  try {
    const application = await app.findUnique({ where: { webHookToken: token?.toString() } });
    if (!application) return res.status(401).json({ msg: 'Access Denied' });

    if (application.webHookApi !== `${process.env.APP_HOST}/${webHookApi}`) return res.status(401).json({ msg: 'Access Denied' });

    return res.status(200).send(req.query['hub.challenge']);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ msg: 'Error en el servidor' });
  }
}

// funcion para controlar los mensajes de whatsapp
export const messagesController = async (req: Request, res: Response) => {
  try {
    const io: SocketServer<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> = (req as any).io;
    const { webHookApi } = req.params;
    const { app, campaignDetails } = prisma;

    if (!webHookApi) return res.status(200).json({ msg: 'WebHookApi no encontrado' });

    const aplication = await app.findUnique({
      where: {
        webHookApi: `${process.env.APP_HOST}/${webHookApi}`
      }
    });

    if (!aplication) return res.status(200).json({ msg: 'Bad Request' });

    const reqType = getReqType(req.body);
    if (reqType === 'template') {
      const templateStatus = Templates.getTemplateStatus(req.body);
      io.to(aplication.empresaId.toString()).emit('template-status', templateStatus);
      return res.status(200).json({ msg: 'Template Status Send' });
    }

    const dataMessage = await Messages.getDataMessage(req.body);
    if (!dataMessage) return res.status(200).json({ msg: 'No hay mensajes' });

    if (dataMessage.status) {
      const registroMessage = await campaignDetails.findUnique({
        where: {
          whatsappMessageId: dataMessage.messageId,
        }
      });
      if (!registroMessage) return res.status(200).json({ msg: 'No hay mensajes' });
      if (registroMessage.leido) return res.status(200).json({ msg: 'Mensaje ya leido' });
      switch (dataMessage.status) {
        case 'delivered':
          await campaignDetails.update({
            where: {
              whatsappMessageId: dataMessage.messageId,
            },
            data: {
              entregado: true,
            }
          });
          break;

        case 'read':
          await campaignDetails.update({
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
    const { cliente, mensaje, mensajeLog, chatHistory } = prisma;

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
    });

    const metaApi = MetaApi.createApi(aplication.token!);

    // Mark as read the message
    // await metaApi.post(`/${phoneId}/messages`, {
    //   "messaging_product": "whatsapp",
    //   "status": "read",
    //   "message_id": messageId,
    // });

    const botMessageData = {
      "messaging_product": "whatsapp",
      "to": `${from}`,
      "type": "text",
      "text": {
        body: 'Disculpas, no te tengo registrado en mi base de datos 😢',
      },
    };

    // verificar si el cliente existe
    let client = await cliente.findFirst({
      where: {
        whatsapp: from,
        empresaId: aplication.empresaId,
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

    // console.log({client});


    if (!client.conversacionId) {
      botMessageData.text.body = 'Perdon, no tengo una conversacion asignada para ti 😢';
      await metaApi.post(`/${phoneId}/messages`, botMessageData);
      return res.status(200).json({ msg: 'Message Sent' });
    }

    if (client.ultimoMensajeId || client.isChating) {
      console.log('🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖');

      let lastMessage: Mensaje | null = null;
      if (client.ultimoMensajeId) {
        lastMessage = await mensaje.findUnique({
          where: {
            id: client.ultimoMensajeId,
          }
        });
      }

      if (lastMessage?.mensajeAsesor || client.isChating) {
        console.log('🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖');
        // actualizamos el cliente de la base de datos
        if (!client.isChating) {
          await cliente.update({
            where: {
              id: client.id,
            },
            data: {
              ...client,
              isChating: true
            }
          });
        }

        if (client.chatAsesorId) {
          const chat = {
            mensaje: text,
            clienteId: client.id,
            asesorId: client.chatAsesorId,
            isClient: true,
            empresaId: aplication.empresaId,
          }

          io.to(client.chatAsesorId.toString()).emit('personal-message', chat);
        } else {
          const empresaId = aplication.empresaId.toString();
          const chat = await chatHistory.create({
            data: {
              mensaje: text,
              clienteId: client.id,
              isClient: true,
              asesorId: null,
              empresaId,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            include: {
              Cliente: true,
            }
          });

          io.to(empresaId).emit('enterprise-message', chat);
        }

        return res.status(200).json({ msg: 'Mensaje enviado' });
      }
    }

    // Si no tiene un mensaje, buscar el mensaje principal
    if (!client.ultimoMensajeId) {
      msg = await mensaje.findFirst({
        where: { conversacionId: client.conversacionId, predecesorId: null }
      });

      if (!msg?.anyWord) {
        const palabrasClave = msg!.palabrasClave.split(',');
        const palabraClave = palabrasClave.find(palabra => palabra.toLowerCase() === text.toLowerCase());
        console.log('===================================');
        // console.log({ palabraClave, palabrasClave, text })
        // console.log('===================================');

        // si anyword es falso y no hay palabras clave, enviar un mensaje de no entendi
        if (!palabraClave) {
          botMessageData.text.body = msg?.altMessage || 'Perdon, no entiendo tu mensaje 😢';
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
        // console.log({ palabrasClaveArray})
        return palabrasClaveArray.find(palabra => text.toLowerCase().includes(palabra.toLowerCase()));
      });

      // Si no encuentra el mensaje, enviar un mensaje de no entendi
      if (!msg) {
        const mensajeNoEntendi = await mensaje.findUnique({
          where: { id: client.ultimoMensajeId }
        });
        // manejando las variables en el mensaje alternativo
        botMessageData.text.body = formatVariables(mensajeNoEntendi?.altMessage, client) || 'Perdon, no entiendo tu mensaje 😢';

        await metaApi.post(`/${phoneId}/messages`, botMessageData);
        return res.status(200).json({ msg: 'Message Sent' });
      }
      // TODO: ver que hacer si no encuentra ningun mensaje hijo
      // res.end();
    }

    // Actualizar ultimo mensaje del cliente
    await cliente.update({ where: { id: client.id }, data: { ultimoMensajeId: msg?.id } });

    let mediaObj = {
      "messaging_product": "whatsapp",
      "recipient_type": "individual",
      "to": `${from}`,
      "type": ""
    };

    // enviar media si existe en el mensaje
    if (msg?.mediaType === 'IMAGE') {
      mediaObj.type = 'image';
      Object.assign(mediaObj, { image: { link: msg.link } });
      // mediaObj.image.link = (msg.link as string);

      await metaApi.post(`/${phoneId}/messages`, mediaObj);
      if (!msg?.cuerpo) return res.status(200).json({ msg: 'Message Sent' });
    }

    if (msg?.mediaType === 'DOCUMENT') {
      mediaObj.type = 'document';
      Object.assign(mediaObj, { document: { link: msg.link } });
      // mediaObj.document.link = (msg.link as string);

      await metaApi.post(`/${phoneId}/messages`, mediaObj);
      if (!msg?.cuerpo) return res.status(200).json({ msg: 'Message Sent' });
    }

    if (msg?.mediaType === 'VIDEO') {
      mediaObj.type = 'video';
      Object.assign(mediaObj, { video: { link: msg.link } });

      await metaApi.post(`/${phoneId}/messages`, mediaObj);
      if (!msg?.cuerpo) return res.status(200).json({ msg: 'Message Sent' });
    }

    botMessageData.text.body = formatVariables((msg!.cuerpo as string), client)!;

    const { data } = await metaApi.post(`/${phoneId}/messages`, botMessageData);

    return res.status(200).json(data);
  } catch (error) {
    console.log(error);
    res.status(200).json({ msg: 'Error' });
  }
}

export async function sendMessage(req: Request, res: Response) {
  try {
    const aplication = (req.body as { app: App; to: string });
    const metaApi = MetaApi.createApi(aplication.app.token!);
    const botMessageData = {
      "messaging_product": "whatsapp",
      "to": `${aplication.to}`,
      "type": "text",
      "text": {
        body: 'Disculpas, no te tengo registrado en mi base de datos 😢',
      },
    };
    const { data } = await metaApi.post(`/${aplication.app.phoneNumberId}/messages`,)
    console.log('success', data);
    return res.status(200).json(data);
  } catch (error) {
    console.log(error);
  }
}
