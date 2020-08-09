import { Folder } from "../../Folder/Folder";
import { File } from "../../file/File";
import * as Path from "path";
import knownFieldDefinitions from "../../field/KnownFieldDefinitions";
import * as fs from "fs-extra";
import { FolderMetadataFile } from "../../file/FolderMetaDataFile";
import { CustomFieldRegistry } from "../CustomFieldRegistry";
import { sanitizeForArchive } from "../../../filenameSanitizer";
import userSettingsSingleton from "../../../UserSettings";
import { LanguageFinder } from "../../../languageFinder/LanguageFinder";
import { Field } from "../../field/Field";
import { IPersonLanguage } from "../../PersonLanguage";
import { FieldSet } from "../../field/FieldSet";

export type idChangeHandler = (oldId: string, newId: string) => void;
export const maxOtherLanguages = 10;
export class Person extends Folder {
  // a callback on the Project that takes care of renaming any references to this person
  protected updateExternalReferencesToThisPerson: idChangeHandler;
  protected previousId: string;

  public ageOn(referenceDate: Date): string {
    return this.properties.getDateField("birthYear").yearsSince(referenceDate);
  }

  // checks either the name or the code
  public referenceIdMatches(name: string): boolean {
    return name.toLowerCase() === this.getIdToUseForReferences().toLowerCase();
  }

  public get /*override*/ metadataFileExtensionWithDot(): string {
    return ".person";
  }

  private get mugshotFile(): File | undefined {
    return this.files.find((f) => {
      return f.describedFilePath.indexOf("_Photo.") > -1;
    });
  }

  public get mugshotPath(): string {
    const m = this.mugshotFile;
    return m ? m.describedFilePath : "";
  }

  /* Used when the user gives us a mugshot, either the first one or replacement one */
  public set mugshotPath(path: string) {
    //console.log("photopath " + path);

    const f = this.mugshotFile;
    if (f) {
      fs.removeSync(f.describedFilePath);
      this.files.splice(this.files.indexOf(f), 1); //remove that one
    }

    const renamedPhotoPath = this.filePrefix + "_Photo" + Path.extname(path);

    this.addOneFile(path, renamedPhotoPath);
  }

  public get displayName(): string {
    return this.getIdToUseForReferences();
  }
  public getIdToUseForReferences(): string {
    const code = this.properties.getTextStringOrEmpty("code").trim();
    return code && code.length > 0
      ? code
      : this.properties.getTextStringOrEmpty("name");
  }

  public constructor(
    directory: string,
    metadataFile: File,
    files: File[],
    customFieldRegistry: CustomFieldRegistry,
    updateExternalReferencesToThisProjectComponent: idChangeHandler,
    languageFinder: LanguageFinder
  ) {
    super(directory, metadataFile, files, customFieldRegistry);
    // we used to not store the name, relying instead on the folder name.
    // However that made it impossible to record someone's actual name if it
    // required, for example, unicode characters.
    if (this.properties.getTextStringOrEmpty("name") === "") {
      this.properties.setText("name", Path.basename(directory));
    }
    this.properties.addHasConsentProperty(this);
    this.properties.addDisplayNameProperty(this);

    this.safeFileNameBase = sanitizeForArchive(
      this.properties.getTextStringOrEmpty("name"),
      userSettingsSingleton.IMDIMode
    );
    this.properties
      .getValueOrThrow("name")
      .textHolder.map.intercept((change) => {
        // a problem with this is that it's going going get called for every keystroke

        return change;
      });
    this.knownFields = knownFieldDefinitions.person; // for csv export
    this.updateExternalReferencesToThisPerson = updateExternalReferencesToThisProjectComponent;
    this.previousId = this.getIdToUseForReferences();

    this.migrateLegacyPersonLanguagesFromNameToCode(languageFinder);
    Person.migrateLegacyIndividualPersonLanguageFieldsToCurrentListOfLanguages(
      this.properties,
      this.metadataFile!.personLanguages,
      languageFinder
    );
  }

  public get languages() {
    return this.metadataFile!.personLanguages;
  }
  public set languages(newLanguageArray: IPersonLanguage[]) {
    this.metadataFile!.personLanguages.splice(0, 99, ...newLanguageArray);
  }
  // see https://trello.com/c/f6hVbGoY and https://trello.com/c/zWaSIuSj
  public static migrateLegacyIndividualPersonLanguageFieldsToCurrentListOfLanguages(
    properties: FieldSet,
    languages: IPersonLanguage[],
    languageFinder: LanguageFinder
  ) {
    // we don't try merging in the old fields; if we already have this modern languages list, then we
    // ignore the new fields.
    if (languages.length) return;
    const primary = properties.getTextFieldOrUndefined("primaryLanguage");
    if (primary && primary.text)
      languages.push({
        tag: primary.text,
        primary: true,
        mother: false,
        father: false,
      });
    let x = properties.getTextFieldOrUndefined("mothersLanguage");
    if (x && x.text) {
      const match = languages.find((l) => l.tag === x!.text);
      if (match) {
        match.mother = true;
      } else {
        languages.push({
          tag: x.text,
          primary: false,
          mother: true,
          father: false,
        });
      }
    }
    x = properties.getTextFieldOrUndefined("fathersLanguage");
    if (x && x.text) {
      const match = languages.find((l) => l.tag === x!.text);
      if (match) {
        match.father = true;
      } else {
        languages.push({
          tag: x.text,
          primary: false,
          mother: false,
          father: true,
        });
      }
    }
    for (let i = 0; i < maxOtherLanguages; i++) {
      x = properties.getTextFieldOrUndefined("otherLanguage" + i);
      if (x && x.text) {
        const match = languages.find((l) => l.tag === x!.text);
        if (!match) {
          languages.push({
            tag: x.text,
            primary: false,
            mother: false,
            father: false,
          });
        }
      }
    }

    // preserve contents of the legacy primaryLanguageLearnedIn field which was labeled as "detail" in some versions.
    const legacyLearnedin = properties.getTextFieldOrUndefined(
      "primaryLanguageLearnedIn"
    );
    if (legacyLearnedin) {
      const primaryLanguageName =
        primary && primary.text
          ? languageFinder.findOneLanguageNameFromCode_Or_ReturnCode(
              primary.text
            )
          : "???";
      const d = properties.getTextStringOrEmpty("description");
      properties.setText(
        "description",
        `${d} Info about ${primaryLanguageName}: ${legacyLearnedin}`
      );
    }
  }

  // Note: this migration happened a couple months before we switched to the new PersonLanguages structure
  private migrateLegacyPersonLanguagesFromNameToCode(
    languageFinder: LanguageFinder
  ) {
    [
      "primaryLanguage",
      "fathersLanguage",
      "mothersLanguage",
    ].forEach((fieldName) =>
      Person.migrateOnePersonLanguageFromNameToCode(
        this.properties.getTextFieldOrUndefined(fieldName),
        languageFinder
      )
    );
    for (let i = 0; i < maxOtherLanguages; i++) {
      Person.migrateOnePersonLanguageFromNameToCode(
        this.properties.getTextFieldOrUndefined("otherLanguage" + i),
        languageFinder
      );
    }
  }
  // Note: this migration happened a couple months before we switched to the new PersonLanguages structure
  // public and static to make it easier to unit test
  public static migrateOnePersonLanguageFromNameToCode(
    field: Field | undefined,
    languageFinder: LanguageFinder
  ) {
    try {
      if (!field) return;
      const nameOrCode = field.text;
      if (!nameOrCode) {
        return; // leave it alone
      }
      //In SayMore and lameta < 0.8.7, this was stored as a name, rather than a code.
      const possibleCode = languageFinder.findOne639_3CodeFromName(
        nameOrCode,
        undefined
      );

      if (possibleCode === "und") {
        // just leave it alone. If we don't recognize a language name, it's better to just not convert it than
        // to lose it.
        return;
      }
      let code;
      if (possibleCode === undefined && nameOrCode.length === 3) {
        code = nameOrCode;
      }
      // I don't suppose this would ever happen, but it would be unambiguous
      else if (
        possibleCode &&
        nameOrCode.length === 3 &&
        possibleCode === nameOrCode
      ) {
        code = nameOrCode;
      }
      // ambiguous, but a sampling suggests that 3 letter language names are always given a matching 3 letter code.
      else if (
        possibleCode &&
        nameOrCode.length === 3 &&
        possibleCode !== nameOrCode
      ) {
        // let's error on the side of having the correct code already. Could theoretically
        // give wrong code for some field filled out in a pre-release version of
        code = nameOrCode;
      }
      // otherwise, go with the name to code lookup
      else {
        code = possibleCode;
      }
      field.setValueFromString(code);

      //console.log(`Migrate person lang ${key}:${nameOrCode} --> ${code}`);
    } catch (err) {
      const ex = err as Error;
      ex.message = `${err} (migrateOnePersonLanguage: nameOrCode = '${
        field!.text
      }')`;
      throw ex;
    }
  }

  public static fromDirectory(
    directory: string,
    customFieldRegistry: CustomFieldRegistry,
    updateExternalReferencesToThisProjectComponent: idChangeHandler,
    languageFinder: LanguageFinder
  ): Person {
    const metadataFile = new PersonMetadataFile(directory, customFieldRegistry);
    const files = this.loadChildFiles(
      directory,
      metadataFile,
      customFieldRegistry
    );
    return new Person(
      directory,
      metadataFile,
      files,
      customFieldRegistry,
      updateExternalReferencesToThisProjectComponent,
      languageFinder
    );
  }
  public static saveFolderMetaData() {
    //console.log("saving " + person.getString("title"));
    //fs.writeFileSync(person.path + ".test", JSON.stringify(person), "utf8");
  }

  // override
  protected textValueThatControlsFolderName(): string {
    return this.properties.getTextStringOrEmpty("name").trim();
  }

  // override
  public wouldCollideWithIdFields(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    return (
      normalized === this.textValueThatControlsFolderName() ||
      normalized === this.properties.getTextStringOrEmpty("code").toLowerCase()
    );
  }

  // A note about name vs. ID. Here "ID" may be the name or the code, since
  // the rule we inherited from SM Classic is that if a Person has something
  // in the "code" field, then that acts as the display name and id around
  // the whole system.
  public IdMightHaveChanged() {
    if (this.previousId !== this.getIdToUseForReferences()) {
      console.log(
        `Updating References ${
          this.previousId
        } --> ${this.getIdToUseForReferences()}`
      );

      // Let the project inform any sessions pointing at us to update their references
      if (this.updateExternalReferencesToThisPerson) {
        this.updateExternalReferencesToThisPerson(
          this.previousId,
          this.getIdToUseForReferences()
        );
      }
    }
    // save this for next time
    this.previousId = this.getIdToUseForReferences();
  }
}

export class PersonMetadataFile extends FolderMetadataFile {
  constructor(directory: string, customFieldRegistry: CustomFieldRegistry) {
    super(
      directory,
      "Person",
      true,
      ".person",
      knownFieldDefinitions.person,
      customFieldRegistry
    );
  }
}
