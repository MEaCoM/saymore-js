import { observable } from "mobx";
import TextHolder from "./TextHolder";
import { Moment } from "moment";
const moment = require("moment");

const titleCase = require("title-case");
//import * as assert from "assert";

export interface IFieldDefinition {
  key: string;
  englishLabel?: string;
  defaultValue?: string;
  type: string;
  form: string; // what form this shows on, if not the main one
  //visibility?: string;
  cssClass?: string;
  choices?: string[];
}

export enum FieldType {
  Text,
  Date,
  Image
}
export enum FieldVisibility {
  Always,
  IfNotEmpty
}

export class Field {
  public readonly key: string;
  public readonly englishLabel: string; // just for debugging at this point
  public readonly type: FieldType;
  public readonly form: string; // where to show it
  public readonly visibility: FieldVisibility;
  public readonly cssClass: string;
  @observable public textHolder = new TextHolder();
  public choices: string[];

  // these definitions normally come from fields.json, which in turn can come form a google spreadsheet with json export
  public static fromFieldDefinition(definition: IFieldDefinition): Field {
    if (!definition.form || definition.form.length === 0) {
      definition.form = "primary";
    }
    const type = definition.type
      ? FieldType[definition.type as keyof typeof FieldType]
      : FieldType.Text;
    const choices = definition.choices ? definition.choices : [];

    return new Field(
      definition.key,
      type,
      definition.defaultValue,
      definition.englishLabel,
      definition.form,
      FieldVisibility.Always, //todo
      choices,
      definition.cssClass
    );
  }

  public constructor(
    key: string,
    type: FieldType = FieldType.Text,
    englishValue: string = "",
    englishLabel: string = titleCase(key),
    form: string = "",
    visibility: FieldVisibility = FieldVisibility.Always,
    choices: string[] = [],
    cssClass: string = ""
  ) {
    this.key = key;
    this.englishLabel = englishLabel;
    this.form = form;
    this.type = type;
    this.visibility = visibility;
    this.cssClass = cssClass;
    this.text = englishValue;
    this.choices = choices;
  }

  get text(): string {
    return this.textHolder.textInDefaultLanguage;
  }
  set text(value: string) {
    this.textHolder.textInDefaultLanguage = value;
  }
  public toString(): string {
    return this.text;
  }
  public setValueFromString(s: string): any {
    this.text = s;
  }

  public asDate(): Date {
    return new Date(Date.parse(this.text));
  }

  public asISODateString(): string {
    if (moment(this.text).isValid()) {
      return this.asDate().toISOString();
    }
    return "";
  }
  public asLocaleDateString(): string {
    if (moment(this.text).isValid()) {
      return this.asDate().toLocaleDateString();
    }
    return "";
  }
  public stringify(): string {
    switch (this.type) {
      case FieldType.Text:
        return `"${this.key}":"${Field.escapeSpecialChars(this.text)}"`;
      case FieldType.Date:
        return `"${this.key}":"${this.asISODateString()}"`;
      default:
        throw new Error("stringify() Unexpected type " + this.type);
    }
  }
  // public objectForSerializing(): object {
  //   throw new Error("Subclasses must implement objectForSerializing");
  // }

  //https://stackoverflow.com/questions/4253367/how-to-escape-a-json-string-containing-newline-characters-using-javascript
  protected static escapeSpecialChars(s: string): string {
    return s
      .replace(/\\n/g, "\\n")
      .replace(/\\'/g, "\\'")
      .replace(/\\"/g, '\\"')
      .replace(/\\&/g, "\\&")
      .replace(/\\r/g, "\\r")
      .replace(/\\t/g, "\\t")
      .replace(/\\b/g, "\\b")
      .replace(/\\f/g, "\\f");
  }
}
