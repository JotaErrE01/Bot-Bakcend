import { Cliente } from "@prisma/client";

export const formatVariables = (msg: string | null | undefined, client: Cliente): string | null => {
  if (!msg) return null;
  const validVariables = ['{{nombre}}', '{{apellido}}', '{{email}}', '{{whatsapp}}', '{{num1}}', '{{num2}}', '{{text1}}', '{{text2}}', '{{fecha1}}', '{{fecha2}}'];
  const variables = [...new Set(msg.match(/{{[\w]{1,}}}/ig) || [])];
  const msgVariables = variables.filter(variable => validVariables.includes(variable));

  let altMessage = msg;
  msgVariables.forEach(variable => {
    if (validVariables.includes(variable)) {
      let key: string = variable.replace('{{', '').replace('}}', '');
      let replacer = '';
      if (key === 'fecha1') key = 'date1';
      if (key === 'fecha2') key = 'date2';
      if(client[(key as keyof Cliente)]) replacer = <string>client[(key as keyof Cliente)!];

      if(key === 'nombre') replacer = `${client.nombre} ${client.apellido}`;

      altMessage = altMessage.replaceAll(variable, `${replacer}`);
    }
  });

  return altMessage;
}