import { Folder } from "../../Folder";
import { File, Contribution } from "../../file/File";
import * as Path from "path";
import { IChoice } from "../../field/Field";
import mobx from "mobx";
import { FolderMetadataFile } from "../../file/FolderMetaDataFile";
const knownFieldDefinitions = require("../../field/fields.json");
const genres = require("./genres.json");

export class Session extends Folder {
  public get metadataFileExtensionWithDot(): string {
    return ".session";
  }

  public get displayName(): string {
    return (
      this.properties.getTextStringOrEmpty("title") ||
      this.properties.getTextStringOrEmpty("id") ||
      "unknown"
    );
  }

  public constructor(directory: string, metadataFile: File, files: File[]) {
    super(directory, metadataFile, files);
    this.properties.setText("id", Path.basename(directory));
    this.safeFileNameBase = this.properties.getTextStringOrEmpty("id");
    this.knownFields = knownFieldDefinitions.session; // for csv export
  }
  public static fromDirectory(directory: string): Session {
    const metadataFile = new SessionMetadataFile(directory);
    metadataFile.addTextProperty("status", "", /*persist*/ true, false, false);

    const genreChoices = genres.map((g: any) => {
      return g as IChoice;
    });
    const genreFieldDefinition = knownFieldDefinitions.session.find(
      (o: any) => o.key === "genre"
    );

    genreFieldDefinition.complexChoices = genreChoices;
    const files = this.loadChildFiles(directory, metadataFile);

    //start autosave mobx.autorunAsync(() => this.save(),    10 * 1000 /* min 10 seconds in between */  );

    return new Session(directory, metadataFile, files);
  }
  // override
  protected fieldContentThatControlsFolderName(): string {
    return this.properties.getTextStringOrEmpty("id").trim();
  }

  public get hasMoreFieldsTable(): boolean {
    return true;
  }
  public get hasCustomFieldsTable(): boolean {
    return true;
  }
  public getAllContributionsToAllFiles(): Contribution[] {
    const contributionsToList = new Array<Contribution>();

    this.files.forEach(f =>
      f.contributions.forEach(c => {
        if (c.name && c.name.length > 0 && c.role && c.role.length > 0) {
          // If a person has multiple roles, we list them once for each role. But if
          // the roles are the same, then we don't list them again.
          if (
            !contributionsToList.some(
              existingContribution =>
                existingContribution.name.toLowerCase() ===
                  c.name.toLocaleLowerCase() &&
                existingContribution.role === c.role
            )
          ) {
            contributionsToList.push(c);
          }
        }
      })
    );

    //In addition to being listed in the contributors list for one of the constituent files,
    // people can also be listed as a "particpant", which until we tighten up the semantics,
    // we will take to mean a "speaker".
    this.getParticipantNames().forEach((name: string) => {
      if (
        // possibly they are already listed in the contributions
        !contributionsToList.some(
          x =>
            x.name.toLowerCase() === name.toLocaleLowerCase() &&
            x.role === "speaker"
        )
      ) {
        // 'speaker' is obviously not right for sessions that aren't about
        // speaking... but at the moment that's what SayMore classic
        // assumes, so we don't have another way of knowing from this
        // list what they contributed; they need to show up as a
        // contributor to one of our constituent file. This may
        // change; we could get rid of "participants" and just let
        // the session itself have a "contributors" list
        contributionsToList.push(new Contribution(name, "speaker", "", ""));
      }
    });
    return contributionsToList;
  }
  public getParticipantNames(): string[] {
    return this.properties
      .getTextStringOrEmpty("participants")
      .split(";")
      .map(s => s.trim());
  }
}

export class SessionMetadataFile extends FolderMetadataFile {
  constructor(directory: string) {
    super(
      directory,
      "Session",
      true,
      ".session",
      knownFieldDefinitions.session
    );
  }
}
