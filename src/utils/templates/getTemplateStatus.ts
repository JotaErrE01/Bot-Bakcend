import { ITemplate, TemplateStatus } from '../../interfaces/ITemplate';


export const getTemplateStatus = (template: ITemplate): TemplateStatus => {
  return template.entry[0].changes[0].value.event;
}

