import { Request, Response } from "express";
import { Server as SocketServer } from 'socket.io';
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import axios from 'axios';
import { App, Cliente } from '@prisma/client';
import { formatVariables, Messages, getReqType, Templates, sendMedia, validCodes, connectToOtherBot, RegisterBot, registerClient, savePollResults, agentLogic } from "../utils";
import { MetaApi } from "../api";
import { prisma } from "../db";
import { chatTimeOut } from '../utils/chatTimeOut';
import { serializeBigInt } from "../utils/serializedBigInt";

// funcion para validar el token con meta
export const validarWebHookToken = async (req: Request, res: Response) => {
  const { app } = prisma;
  const token = req.query['hub.verify_token'];
  if (!token) return res.status(400).json({ msg: 'Token no encontrado' });
  const { webHookApi } = req.params;

  try {
    const application = await app.findUnique({ where: { webHookToken: token?.toString() } });

    if (!application || application.isDeleted) return res.status(401).json({ msg: 'Access Denied' });

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
      },
      include: {
        Empresas: true,
      }
    });

    if (!aplication) return res.status(400).json({ msg: 'Bad Request' });

    const reqType = getReqType(req.body);
    if (reqType === 'template') {
      const templateStatus = Templates.getTemplateStatus(req.body);
      io.to(aplication.empresaId.toString()).emit('template-status', templateStatus);
      return res.status(200).json({ msg: 'Template Status Send' });
    }

    const dataMessage = await Messages.getDataMessage(req.body);
    if (!dataMessage) return res.status(400).json({ msg: 'No hay dataMessage' });

    if (dataMessage.status) {
      const registroMessage = await campaignDetails.findUnique({
        where: {
          whatsappMessageId: dataMessage.messageId,
        }
      });
      if (!registroMessage) return res.status(200).json({ msg: 'No hay registro Mensajes detalles' });
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

    const { phoneId, from, text, messageId, name, waId, mediaData } = dataMessage;
    if (!phoneId || !from || !messageId || !name) {
      return res.status(400).json({ msg: 'No hay data mensajes' });
    }

    // create prisma instance
    const { cliente, mensaje, mensajeLog, conversacion, generalMessages } = prisma;

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

    // Inicializar metaApi
    const metaApi = MetaApi.createApi(aplication.token!);

    const botMessageData = {
      "messaging_product": "whatsapp",
      "to": `${from}`,
      "type": "text",
      "text": {
        body: 'Hola!, No te tenemos registrado en nuestra base de datos, pero con gusto te atenderemos.',
      },
    };
    // const postGres = `SELECT * FROM "Paises" p INNER JOIN "Clientes" c on p.id = "paisId" WHERE "empresaId" = ${aplication.empresaId} AND concat(p.codigo, c.whatsapp) = ${from} AND c."isDeleted" = false LIMIT 1;`;
    // const mysqlQuery = `SELECT * FROM Paises p INNER JOIN Clientes c on p.id = paisId WHERE empresaId = "9af9a1a7-80e9-429d-b6ea-57c6a14ba5a6" AND concat(p.codigo, c.whatsapp) = 593986269671 AND c.isDeleted = false LIMIT 1;`
    // console.log(`
    //   SELECT * FROM Paises p INNER JOIN Clientes c on p.id = paisId WHERE empresaId = ${aplication.empresaId} AND concat(p.codigo, c.whatsapp) = ${from} AND c.isDeleted = false LIMIT 1;`)
    const clientResult: Cliente[] | null = await prisma.$queryRaw`
      SELECT * FROM Paises p INNER JOIN Clientes c on p.id = paisId WHERE empresaId = ${aplication.empresaId} AND concat(p.codigo, c.whatsapp) = ${from} AND c.isDeleted = false LIMIT 1;
    `;

    // no existe el cliente TODO: BOT DE REGISTRO
    if (clientResult?.length !== 1) {
      return await RegisterBot(aplication.empresaId, metaApi, phoneId, botMessageData, waId!, res);
    }

    let client = clientResult[0];
    if ((client.nombre === 'REGISTER' || client.apellido === 'REGISTER') && text)
      return await registerClient(client, text, res, metaApi, phoneId, botMessageData);

    let msg;

    const createdMessageData = await generalMessages.create({
      data: {
        appID: aplication.id,
        empresaId: aplication.empresaId,
        idOrigen: client.id,
        origen: 'CLIENTE',
        mensaje: text,
        status: 'ENVIADO',
        updatedAt: new Date(),
        // createdAt: new Date(),
        messageID: messageId,
      }
    });

    chatTimeOut(io, aplication, dataMessage, createdMessageData.createdAt, client, aplication.Empresas.chatTiming);

    if (!client.conversacionId && !client.isChating) {
      const defaultBot = await conversacion.findFirst({
        where: {
          isDeleted: false,
          active: true,
          categoria: 'DEFAULT',
        },
        include: {
          mensajes: {
            where: {
              isDeleted: false,
              predecesorId: null,
            }
          }
        },
      });

      if (!defaultBot) {
        // UPDATE CONVERSATIONID TO DEFAULT BOT
        botMessageData.text.body = 'Perdon, no tengo una conversacion asignada para ti 😢';
        await metaApi.post(`/${phoneId}/messages`, botMessageData);
        return res.status(200).json({ msg: 'Message Sent' });
      }

      client = await cliente.update({
        where: {
          id: client.id,
        },
        data: {
          conversacionId: defaultBot.id
        }
      });
    }

    if (client.isChating) return agentLogic(client, aplication, io, res, { phoneId, from, text, messageId, name, waId, mediaData });

    if (client.ultimoMensajeId && text) {
      const result = await validCodes(client, text, botMessageData, metaApi, phoneId, !client.ultimoMensajeId);
      if (result) return res.status(200).json({ msg: 'Mensaje enviado' });
    }

    // Si no tiene un mensaje, buscar el mensaje principal
    if (!client.ultimoMensajeId && text) {
      msg = await mensaje.findFirst({
        where: { conversacionId: client.conversacionId!, predecesorId: null, isDeleted: false },
        include: { conversaciones: true }
      });

      if (!msg?.anyWord) {
        const palabrasClave = msg!.palabrasClave.split(',');
        const palabraClave = palabrasClave.find(palabra => palabra.toLowerCase() === text?.toLowerCase());

        // si anyword es falso y no hay palabras clave, enviar el mensaje alternativo o el mensaje de no entiendo
        if (!palabraClave) {
          // await generalMessages.create({
          //   data: {
          //     appID: aplication.id,
          //     empresaId: aplication.empresaId,
          //     idOrigen: client.id,
          //     origen: 'CLIENTE',
          //     mensaje: text,
          //     status: 'ENVIADO',
          //     updatedAt: new Date(),
          //     createdAt: new Date(),
          //     messageID: messageId,
          //   }
          // });
          botMessageData.text.body = msg?.altMessage || 'Perdon, no entiendo tu mensaje 😢';
          const { data } = await metaApi.post(`/${phoneId}/messages`, botMessageData);
          await generalMessages.create({
            data: {
              appID: aplication.id,
              empresaId: aplication.empresaId,
              idOrigen: (msg as any).id,
              origen: 'BOT',
              mensaje: botMessageData.text.body,
              status: 'ENVIADO',
              updatedAt: new Date(),
              createdAt: new Date(),
              messageID: data.messages[0].id,
            }
          });
          return res.status(200).json({ msg: 'Message Sent' });
        }
      }
    } else if (text) {
      // Encuentra todos los hijos del ultimo mensaje
      const msgs = await mensaje.findMany({
        where: { conversacionId: client.conversacionId!, predecesorId: client.ultimoMensajeId, isDeleted: false },
        include: { conversaciones: true }
      });

      const existeMensajeAnyWord = msgs.find(msg => msg.anyWord);
      if (!existeMensajeAnyWord) {
        msg = msgs.find(({ palabrasClave }) => {
          const palabrasClaveArray = palabrasClave.split(',').map(palabra => palabra.trim());
          return palabrasClaveArray.find(palabra => text.toLowerCase() === palabra.toLowerCase());
        });
      } else {
        msg = existeMensajeAnyWord;
      }

      // Si no encuentra el mensaje, enviar un mensaje de no entendi
      if (!msg) {
        const mensajeNoEntendi = await mensaje.findUnique({
          where: { id: client.ultimoMensajeId || undefined },
        });

        // manejando las variables en el mensaje alternativo
        botMessageData.text.body = formatVariables(mensajeNoEntendi?.altMessage, client) || 'Perdon, no entiendo tu mensaje 😢';
        // await generalMessages.create({
        //   data: {
        //     appID: aplication.id,
        //     empresaId: aplication.empresaId,
        //     idOrigen: client.id,
        //     origen: 'CLIENTE',
        //     mensaje: text,
        //     status: 'ENVIADO',
        //     updatedAt: new Date(),
        //     createdAt: new Date(),
        //     messageID: messageId,
        //   }
        // });
        const { data } = await metaApi.post(`/${phoneId}/messages`, botMessageData);

        await generalMessages.create({
          data: {
            appID: aplication.id,
            empresaId: aplication.empresaId,
            idOrigen: mensajeNoEntendi!.id,
            origen: 'BOT',
            mensaje: botMessageData.text.body,
            status: 'ENVIADO',
            updatedAt: new Date(),
            createdAt: new Date(),
            messageID: data.messages[0].id,
            recipientId: client.id,
            recipientWhatsapp: client.whatsapp,
          }
        });
        return res.status(200).json({ msg: 'Message Sent' });
      }

      // verfica si es un mensaje que conecta con otro Bot
      if (msg.botIdConexion)
        return await connectToOtherBot(msg, client, metaApi, botMessageData, phoneId, res, aplication, { phoneId, from, text, messageId, name, waId, mediaData });

      // TODO: ver que hacer si no encuentra ningun mensaje hijo
      // res.end();
    }

    if (msg?.conversaciones.categoria === 'POLL' && text) {
      const result = await savePollResults(text, client);
      if (!result) return res.status(400).json({ msg: 'Error en encuestas' });
    }

    // Actualizar ultimo mensaje del cliente
    await cliente.update({ where: { id: client.id }, data: { ultimoMensajeId: msg?.id } });

    // enviar media si existe en el mensaje
    if (msg?.mediaType) {
      const result = await sendMedia(msg, phoneId, metaApi, from, aplication, client, { phoneId, from, text, messageId, name, waId, mediaData });
      if (!result) return res.status(400).json({ msg: 'Error sending media' });
      return res.status(200).json({ msg: 'Message Sent' });
    }

    botMessageData.text.body = formatVariables((msg?.cuerpo as string), client)!;

    if (msg?.mensajeAsesor) {
      const { data } = await metaApi.post(`/${phoneId}/messages`, botMessageData);

      await generalMessages.create({
        data: {
          appID: aplication.id,
          empresaId: aplication.empresaId,
          idOrigen: (msg as any).id,
          origen: 'BOT',
          mensaje: botMessageData.text.body,
          status: 'ENVIADO',
          updatedAt: new Date(),
          createdAt: new Date(),
          messageID: data.messages[0].id,
          typeRecipient: 'AGENTE',
        }
      });

      await cliente.update({
        where: { id: client.id },
        data: {
          isChating: true,
        }
      });

      // TODO: FINALIAZAR CONVERSACION TIMING

      return res.status(200).json({ msg: 'Client chating' });

      // return agentLogic(client, aplication, io, res, { phoneId, from, text, messageId, name, waId, mediaData });
    }

    // await generalMessages.create({
    //   data: {
    //     appID: aplication.id,
    //     empresaId: aplication.empresaId,
    //     idOrigen: client.id,
    //     origen: 'CLIENTE',
    //     mensaje: text,
    //     status: 'ENVIADO',
    //     updatedAt: new Date(),
    //     createdAt: new Date(),
    //     messageID: messageId,
    //   }
    // });

    const { data } = await metaApi.post(`/${phoneId}/messages`, botMessageData);

    await generalMessages.create({
      data: {
        appID: aplication.id,
        empresaId: aplication.empresaId,
        idOrigen: (msg as any).id,
        origen: 'BOT',
        mensaje: botMessageData.text.body,
        status: 'ENVIADO',
        updatedAt: new Date(),
        createdAt: new Date(),
        messageID: data.messages[0].id,
        recipientId: client.id,
        recipientWhatsapp: client.whatsapp,
      }
    });

    return res.status(200).json(data);
  } catch (error) {
    console.log(error);
    if (axios.isAxiosError(error)) {
      console.log(error.response?.data);
    }
    res.status(400).json({ msg: 'Error' });
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

export const revalidateAdminChats = async (req: Request, res: Response) => {
  const io: SocketServer<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> = (req as any).io;
  const { usuario } = prisma;

  const { empresaId, clienteId, chatAsesorId } = req.body;

  const data = { clienteId, Cliente: { chatAsesorId } };
  try {
    const allAdminsSupervisors = await usuario.findMany({
      where: {
        empresaId,
        OR: [
          {
            Roles: {
              Acciones: {
                some: {
                  nombre: 'SUPER_CHAT_PERMISSION'
                }
              }
            }
          },
          {
            RolesDefault: {
              Acciones: {
                some: {
                  nombre: 'SUPER_CHAT_PERMISSION'
                }
              }
            }
          }
        ]
      }
    });

    allAdminsSupervisors.forEach((admin) => {
      io.to(admin.id.toString()).emit('supervisor-message', serializeBigInt(data));
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ msg: 'Error' });
  }
};
