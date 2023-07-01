import { App, Cliente, Usuario } from '@prisma/client';
import { Server as SocketServer } from 'socket.io';
import cron from 'node-cron';
import { serializeBigInt } from './serializedBigInt';
import { prisma } from '../db/config';
import { MetaApi } from "../api";
import { Messages } from ".";

export const chatTimeOut = (io: SocketServer, aplication: App, dataMsg: Messages.IGetDataMessage, startDate: Date, client: Cliente, timing: number = 5, isAgent?: boolean) => {
  // get the current date with javascript
  const createdAt = new Date(startDate);

  const minutes = timing * 60000;
  // const stopTime = new Date(createdAt.getTime() + (timing * 1000));
  const stopTime = new Date(createdAt.getTime() + minutes);
  const stopTime5MinutesBefore = new Date(createdAt.getTime() + (minutes - (5 * 60000)));
  const cronString = `${stopTime.getSeconds()} ${stopTime.getMinutes()} ${stopTime.getHours()} ${stopTime.getDate()} ${stopTime.getMonth() + 1} *`;
  const cronString5MintesBefore = `${stopTime5MinutesBefore.getSeconds()} ${stopTime5MinutesBefore.getMinutes()} ${stopTime5MinutesBefore.getHours()} ${stopTime5MinutesBefore.getDate()} ${stopTime5MinutesBefore.getMonth() + 1} *`;

  const task = cron.getTasks().get(client.id.toString());
  const taskBeforeStop = cron.getTasks().get(`${client.id.toString()}-5min`);
  if (taskBeforeStop) taskBeforeStop.stop();
  if (task) task.stop();

  if(isAgent) {
    const jobBeforeStop = cron.schedule(cronString5MintesBefore, async () => {
      const dataMessage = {
        "messaging_product": "whatsapp",
        "to": `${dataMsg.from}`,
        "type": "text",
        "text": {
          body: 'El chat se cerrara en 5 minutos. Si desea continuar con la conversación, por favor conteste este mensaje.',
        },
      };
    
      const metaApi = MetaApi.createApi(aplication.token!);
      await metaApi.post(`/${aplication.phoneNumberId}/messages`, dataMessage);
  
      jobBeforeStop.stop();
    }, {
      scheduled: true,
      timezone: 'America/Guayaquil',
      name: `${client.id.toString()}-5min`
    });
  }

  const job = cron.schedule(cronString, async () => {
    await sendStopMessage(dataMsg, aplication, client);
    io.emit('chatTimeOut', serializeBigInt({ clienteId: client.id }));
    job.stop();
  }, {
    scheduled: true,
    timezone: 'America/Guayaquil',
    name: client.id.toString()
  });
}

const sendStopMessage = async (dataMsg: Messages.IGetDataMessage, aplication: App, client: Cliente): Promise<boolean> => {
  const { cliente, usuario, generalMessage } = prisma;
  const dataMessage = {
    "messaging_product": "whatsapp",
    "to": `${dataMsg.from}`,
    "type": "text",
    "text": {
      body: 'El tiempo de respuesta ha finalizado. Sera redireccionado a nuestro bot de atención al cliente.',
    },
  };

  const metaApi = MetaApi.createApi(aplication.token!);

  try {
    const clientDb = await cliente.findUnique({
      where: {
        id: client.id,
      },
    });

    if (!clientDb || clientDb.isDeleted) throw new Error('Cliente no encontrado');

    await cliente.update({
      where: {
        id: client.id,
      },
      data: {
        chatAsesorId: null,
        ultimoMensajeId: null,
        conversacionId: null,
        isChating: false,
        asociatedDepartmentId: null,
      }
    });
    
    if(clientDb.chatAsesorId) {
      await usuario.update({
        where: {
          id: clientDb.chatAsesorId,
        },
        data: {
          quantityChats: {
            decrement: 1,
          }
        }
      });
    }

    const { data } = await metaApi.post(`/${aplication.phoneNumberId}/messages`, dataMessage);

    // TODO: Guardar el mensaje en la base de datos
    // await generalMessage.create({
    //   data: {
    //     mensaje: dataMessage.text.body,
    //     appID: aplication.id,
    //     empresaId: aplication.empresaId,
    //     origen: 'BOT',
    //     idOrigen: 1,
    //     status: 'ENVIADO',
    //     messageID: data.,
    //   }
    // });

    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}