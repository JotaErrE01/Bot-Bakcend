export interface ITemplate {
  entry:  Entry[];
  object: string;
}

interface Entry {
  id:      string;
  time:    number;
  changes: Change[];
}

interface Change {
  value: Value;
  field: string;
}

interface Value {
  event:                     TemplateStatus;
  message_template_id:       number;
  message_template_name:     string;
  message_template_language: string;
  reason:                    string;
}

export type TemplateStatus = 'REJECTED' | 'APPROVED' | 'PENDING';
