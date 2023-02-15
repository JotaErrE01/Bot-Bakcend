import { Usuario, Cliente, App } from '@prisma/client';
import { Server as SocketServer } from 'socket.io';
import { prisma } from '../db/config';
import { Response } from 'express';
import { serializeBigInt } from './serializedBigInt';
import { MetaApi } from '../api';
import { MediaType } from '../interfaces/IWebHookText';

export const agentLogic = async (client: Cliente, aplication: App, io: SocketServer, res: Response, text?: string, mediaData?: MediaType | undefined) => {
  const { usuario, cliente, chatHistory, rolesDefault, roles } = prisma;

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

    let mediaChatObj: { media?: string, mediaType?: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' } = {};
    if (mediaData) {
      const metaApi = MetaApi.createApi(aplication.token!);
      const { data } = await metaApi.get(`${mediaData.id}`);
      mediaChatObj = {
        media: data.url,
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
        mensaje: text,
        clienteId: client.id,
        asesorId: client.chatAsesorId,
        isClient: true,
        empresaId: aplication.empresaId,
        ...mediaChatObj
      }
      // console.log({chat})
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

        const chat = {
          mensaje: text,
          clienteId: client.id,
          asesorId: asesor.id,
          isClient: true,
          empresaId: aplication.empresaId,
          ...mediaChatObj
        }

        io.to(asesor.id.toString()).emit('personal-message', serializeBigInt(chat));
        return res.status(200).json({ msg: 'Mensaje enviado personal-message' });
      }

      const chat = await chatHistory.create({
        data: {
          mensaje: text,
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
