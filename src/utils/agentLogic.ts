import { Usuario, Cliente, App } from '@prisma/client';
import { Server as SocketServer } from 'socket.io';
import { prisma } from '../db/config';
import { Response } from 'express';
import { serializeBigInt } from './serializedBigInt';
import { MetaApi } from '../api';
import { Messages } from '.';

export const agentLogic = async (client: Cliente, aplication: App, io: SocketServer, res: Response, dataMsg: Messages.IGetDataMessage) => {
  const { usuario, cliente, chatHistory, rolesDefault, roles, generalMessages, empresas } = prisma;

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

    const empresa = await empresas.findUnique({
      where: {
        id: aplication.empresaId
      },
    });

    if(empresa?.isDeleted)  return res.status(404).json({ msg: 'Empresa no encontrada' });

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
      const chat = {
        mensaje: dataMsg.mediaData?.caption || dataMsg.text || '',
        clienteId: client.id,
        asesorId: client.chatAsesorId,
        isClient: true,
        empresaId: aplication.empresaId,
        ...mediaChatObj
      }

      await generalMessages.create({
        data: {
          mensaje: dataMsg.mediaData?.caption || dataMsg.text || '',
          messageID: dataMsg.messageId,
          appID: aplication.id,
          empresaId: aplication.empresaId,
          idOrigen: client.id,
          recipientId: client.chatAsesorId,
          status: 'ENVIADO',
          recipientWhatsapp: empresa?.whatsapp,
          origen: 'CLIENTE',
          isDeleted: false,
          updatedAt: new Date(),
        }
      });
      
      io.to(client.chatAsesorId.toString()).emit('personal-message', serializeBigInt(chat));
    } else {
      const empresaId = aplication.empresaId.toString();

      // BUSCAR EL AGENTE CON MENOS CHATS Y ASIGNARLE EL CLIENTE
      const asesores: Usuario[] = await prisma.$queryRaw`
        SELECT * FROM Usuarios u
        WHERE
          empresaId = ${empresaId}
          AND u.quantityChats < u.maxChats
          AND u.status = TRUE
        ORDER BY u.quantityChats ASC LIMIT 1;
      `;

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

          const hasPermission = roleDefault?.Acciones.find((action) => action.nombre === 'CHAT_PERMISSION');

          if (!hasPermission) {
            return res.status(403).json({ msg: 'El agente no tiene permiso para chatear' });
          }
        } else if (asesor.roleId) {
          const role = await roles.findUnique({
            where: {
              id: asesor.roleId
            },
            include: {
              Acciones: true
            }
          });

          const hasPermission = role?.Acciones.find((action) => action.nombre === 'CHAT_PERMISSION');

          if (!hasPermission) {
            return res.status(200).json({ msg: 'El agente no tiene permiso para chatear' });
          }
        }

        await usuario.update({
          where: {
            id: asesor.id,
          },
          data: {
            quantityChats: {
              increment: 1,
            }
          }
        });

        await cliente.update({
          where: {
            id: client.id,
          },
          data: {
            chatAsesorId: BigInt(Number(asesor.id)),
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
          }
        });

        const chat = {
          mensaje: dataMsg.text,
          clienteId: client.id,
          asesorId: asesor.id,
          isClient: true,
          empresaId: aplication.empresaId,
          ...mediaChatObj
        }

        io.to(asesor.id.toString()).emit('personal-message', serializeBigInt(chat));
        return res.status(200).json({ msg: 'Mensaje enviado personal-message' });
      }

      await generalMessages.create({
        data: {
          mensaje: dataMsg.mediaData?.caption || dataMsg.text || '',
          messageID: dataMsg.messageId,
          appID: aplication.id,
          empresaId: aplication.empresaId,
          idOrigen: client.id,
          recipientId: null,
          status: 'ENVIADO',
          recipientWhatsapp: empresa?.whatsapp,
          origen: 'CLIENTE',
          isDeleted: false,
          updatedAt: new Date(),
        }
      });

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
      io.to(empresaId).emit('enterprise-message', serializeBigInt(chat));
    }

    return res.status(200).json({ msg: 'Mensaje enviado personal-message/enterprise' });
  } catch (error) {
    console.log(error);
    console.log('Error en SOCKETS AGENTE LOGIC')
    return res.status(400).json({ msg: 'Error en el servidor' });
  }
}
