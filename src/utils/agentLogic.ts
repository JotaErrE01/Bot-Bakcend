import { Usuario, Cliente, App, Departamentos } from '@prisma/client';
import { Server as SocketServer } from 'socket.io';
import { prisma } from '../db/config';
import { Response } from 'express';
import { serializeBigInt } from './serializedBigInt';
import { MetaApi } from '../api';
import { Messages } from '.';
import { chatTimeOut } from './chatTimeOut';
// let timing: NodeJS.Timeout;
// let coutner = 0;
export const agentLogic = async (client: Cliente, aplication: App, io: SocketServer, res: Response, dataMsg: Messages.IGetDataMessage) => {
  const { usuario, cliente, chatHistory, rolesDefault, roles, generalMessages, empresas, departamentos } = prisma;
  const metaApi = MetaApi.createApi(aplication.token!);
  const dataMessage = {
    "messaging_product": "whatsapp",
    "to": `${dataMsg.from}`,
    "type": "text",
    "text": {
      body: 'No se encontro el departamento',
    },
  };

  try {
    // actualizamos el cliente de la base de datos
    if (!client.isChating) {
      await cliente.update({
        where: {
          id: client.id,
        },
        data: {
          // ...client,
          isChating: true
        }
      });
    }

    let department: Departamentos | null = null;
    if (!client.asociatedDepartmentId) {
      // verificar el departemento del agente
      department = await departamentos.findUnique({
        where: {
          codigoAsociado: `${aplication.empresaId}_${dataMsg.text}`
        }
      });

      if (!department) {
        const { data } = await metaApi.post(`/${aplication.phoneNumberId}/messages`, dataMessage);
        return res.status(200).json({ msg: 'Departamento no encontrado' });
      } else {
        dataMessage.text.body = 'En breve un asesor se pondra en contacto con usted';
        const { data } = await metaApi.post(`/${aplication.phoneNumberId}/messages`, dataMessage);

        client = await cliente.update({
          where: {
            id: client.id,
          },
          data: {
            asociatedDepartmentId: department.id
          }
        });
      }
    }

    department = await departamentos.findUnique({
      where: {
        id: client.asociatedDepartmentId!
      }
    });

    const empresa = await empresas.findUnique({
      where: {
        id: aplication.empresaId
      },
    });

    if (empresa?.isDeleted) return res.status(404).json({ msg: 'Empresa no encontrada' });

    let mediaChatObj: { media?: string, mediaType?: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' } = {};
    if (dataMsg.mediaData) {
      const metaApi = MetaApi.createApi(aplication.token!);
      const { data } = await metaApi.get(`${dataMsg.mediaData.id}`);
      mediaChatObj = {
        media: dataMsg.mediaData.id,
      }
      if (data.mime_type.includes('image')) {
        Object.assign(mediaChatObj, { mediaType: 'IMAGE' });
      } else if (data.mime_type.includes('video')) {
        Object.assign(mediaChatObj, { mediaType: 'VIDEO' });
      } else if (data.mime_type.includes('audio')) {
        Object.assign(mediaChatObj, { mediaType: 'AUDIO' });
      } else {
        Object.assign(mediaChatObj, { mediaType: 'DOCUMENT' });
      }
    }

    if (client.chatAsesorId) {
      const chat = await chatHistory.create({
        data: {
          mensaje: dataMsg.mediaData?.caption || dataMsg.text || '',
          clienteId: client.id,
          asesorId: client.chatAsesorId,
          isClient: true,
          empresaId: aplication.empresaId,
          ...mediaChatObj,
          updatedAt: new Date(),
        },
        include: {
          Cliente: true,
        }
      });

      // await generalMessages.create({
      //   data: {
      //     mensaje: dataMsg.mediaData?.caption || dataMsg.text || '',
      //     messageID: dataMsg.messageId,
      //     appID: aplication.id,
      //     empresaId: aplication.empresaId,
      //     idOrigen: client.id,
      //     recipientId: client.chatAsesorId,
      //     status: 'ENVIADO',
      //     recipientWhatsapp: empresa?.whatsapp,
      //     origen: 'CLIENTE',
      //     isDeleted: false,
      //     updatedAt: new Date(),
      //   }
      // });

      const asesor = await usuario.findUnique({
        where: {
          id: client.chatAsesorId
        },
        include: {
          Departamentos: true,
        }
      });

      if (!asesor || asesor.isDeleted) throw new Error('Asesor no encontrado');

      await generalMessages.create({
        data: {
          mensaje: dataMsg.mediaData?.caption || dataMsg.text || '',
          messageID: dataMsg.messageId,
          appID: aplication.id,
          empresaId: aplication.empresaId,
          idOrigen: client.id,
          recipientId: asesor.id,
          status: 'ENVIADO',
          recipientWhatsapp: empresa?.whatsapp,
          origen: 'CLIENTE',
          isDeleted: false,
          updatedAt: new Date(),
          typeRecipient: 'ASESOR',
        }
      });

      chatTimeOut(io, aplication, dataMsg, chat.createdAt, chat.Cliente, department?.chatTiming, asesor!);

      io.to(client.chatAsesorId.toString()).emit('personal-message', serializeBigInt(chat)); //!

      const allAdminsSupervisors = await usuario.findMany({
        where: {
          empresaId: aplication.empresaId,
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

      allAdminsSupervisors.forEach(async (admin) => {
        io.to(admin.id.toString()).emit('supervisor-message', serializeBigInt(chat));
      });
    } else {
      const empresaId = aplication.empresaId.toString();
      const codigoAsociado = `${empresaId}_${dataMsg.text}`;

      // BUSCAR EL AGENTE CON MENOS CHATS Y ASIGNARLE EL CLIENTE
      const asesores: Usuario[] = await prisma.$queryRaw`
        SELECT * FROM _DepartamentoToUsuario du
        INNER JOIN Departamentos d ON du.A = d.id
        INNER JOIN Usuarios u ON u.id = du.B
        WHERE
          u.empresaId = ${empresaId}
          AND u.quantityChats < u.maxChats
          AND u.status = TRUE
          AND d.codigoAsociado = ${codigoAsociado}
        ORDER BY
          u.quantityChats ASC
        LIMIT 1;
      `;

      //   console.log('🚀🚀🚀🚀🚀🚀🚀');
      //   console.log({ asesores })
      //   console.log('🚀🚀🚀🚀🚀🚀🚀');

      //   console.log(`
      //   SELECT * FROM _DepartamentoToUsuario du
      //   INNER JOIN Departamentos d ON du.A = d.id
      //   INNER JOIN Usuarios u ON u.id = du.B
      //   WHERE
      //     u.empresaId = ${empresaId}
      //     AND u.quantityChats < u.maxChats
      //     AND u.status = TRUE
      //     AND d.codigoAsociado = ${empresaId}_${dataMsg.text}
      //   ORDER BY
      //     u.quantityChats ASC
      //   LIMIT 1;
      // `);


      // Asignar el cliente con el agente con menos chats
      if (asesores.length === 1) {
        const asesor = asesores[0];

        // verificar si tiene permiso para chatear
        if (asesor.roleDefaultId) {
          const roleDefault = await rolesDefault.findUnique({
            where: {
              id: asesor.roleDefaultId
            },
            include: {
              Acciones: true
            }
          });

          const hasPermission = roleDefault?.Acciones.find((action) => action.nombre === 'CHAT_PERMISSION' || action.nombre === 'SUPER_CHAT_PERMISSION');

          if (!hasPermission) return res.status(403).json({ msg: 'El agente no tiene permiso para chatear' });
        } else if (asesor.roleId) {
          const role = await roles.findUnique({
            where: {
              id: asesor.roleId
            },
            include: {
              Acciones: true
            }
          });

          const hasPermission = role?.Acciones.find((action) => action.nombre === 'CHAT_PERMISSION' || action.nombre === 'SUPER_CHAT_PERMISSION');

          if (!hasPermission) return res.status(403).json({ msg: 'El agente no tiene permiso para chatear' });
        }

        await usuario.update({
          where: {
            id: asesor.id,
          },
          data: {
            quantityChats: {
              increment: 1, // incrementamos la cantidad de chats del agente
            }
          }
        });

        await cliente.update({
          where: {
            id: client.id,
          },
          data: {
            chatAsesorId: BigInt(Number(asesor.id)), // asignamos el agente al cliente
          }
        });

        const chat = await chatHistory.create({
          data: {
            mensaje: dataMsg.mediaData?.caption || dataMsg.text || '',
            clienteId: client.id,
            asesorId: asesor.id,
            isClient: true,
            empresaId: aplication.empresaId,
            ...mediaChatObj,
            updatedAt: new Date(),
          },
          include: {
            Cliente: true,
          }
        });

        await generalMessages.create({
          data: {
            mensaje: dataMsg.mediaData?.caption || dataMsg.text || '',
            messageID: dataMsg.messageId,
            appID: aplication.id,
            empresaId: aplication.empresaId,
            idOrigen: client.id,
            recipientId: asesor.id,
            status: 'ENVIADO',
            recipientWhatsapp: empresa?.whatsapp,
            origen: 'CLIENTE',
            isDeleted: false,
            updatedAt: new Date(),
            typeRecipient: 'AGENTE',
          }
        });

        chatTimeOut(io, aplication, dataMsg, chat.createdAt, chat.Cliente, department?.chatTiming, asesor);

        io.to(asesor.id.toString()).emit('personal-message', serializeBigInt(chat));
        io.to(asesor.id.toString()).emit('supervisor-message', serializeBigInt(chat));
        return res.status(200).json({ msg: 'Mensaje enviado personal-message' });
      }

      // await generalMessages.create({
      //   data: {
      //     mensaje: dataMsg.mediaData?.caption || dataMsg.text || '',
      //     messageID: dataMsg.messageId,
      //     appID: aplication.id,
      //     empresaId: aplication.empresaId,
      //     idOrigen: client.id,
      //     recipientId: null,
      //     status: 'ENVIADO',
      //     recipientWhatsapp: empresa?.whatsapp,
      //     origen: 'CLIENTE',
      //     isDeleted: false,
      //     updatedAt: new Date(),
      //   }
      // });

      const chat = await chatHistory.create({
        data: {
          mensaje: dataMsg.text,
          clienteId: BigInt(Number(client.id)),
          isClient: true,
          asesorId: null,
          empresaId,
          media: mediaChatObj.media || undefined,
          mediaType: mediaChatObj.mediaType || undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          Cliente: true,
        }
      });

      chatTimeOut(io, aplication, dataMsg, chat.createdAt, chat.Cliente, department?.chatTiming);
      io.to(empresaId).emit('enterprise-message', serializeBigInt(chat)); //!
    }

    return res.status(200).json({ msg: 'Mensaje enviado personal-message/enterprise' });
  } catch (error) {
    console.log(error);
    console.log('Error en SOCKETS AGENTE LOGIC')
    return res.status(400).json({ msg: 'Error en el servidor' });
  }
}

// const setClientTiming = (aplication: App, dataMsg: Messages.IGetDataMessage, chat: ChatHistory & { Cliente: Cliente; }, timing: number = 5) => {
//   const createdAt = new Date(chat.createdAt);
//   const minutes = timing * 60000;
//   // const stopTime = new Date(createdAt.getTime() + (timing * 1000));
//   const stopTime = new Date(createdAt.getTime() + minutes);
//   const cronString = `${stopTime.getSeconds()} ${stopTime.getMinutes()} ${stopTime.getHours()} ${stopTime.getDate()} ${stopTime.getMonth() + 1} *`;

//   const task = cron.getTasks().get(chat.Cliente.id.toString());
//   if (task) task.stop();

//   const job = cron.schedule(cronString, async () => {
//     await sendStopMessage(dataMsg, aplication, chat);
//     job.stop();
//   }, {
//     scheduled: true,
//     timezone: 'America/Guayaquil',
//     name: chat.Cliente.id.toString()
//   });
// }

