/*
Install demo data to test and show off the Spaciblō system
*/
package main

import (
	"bytes"
	"io/ioutil"
	"log"
	"os"
	"path"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
	"spaciblo.org/db"
)

var logger = log.New(os.Stdout, "[demo] ", 0)

const DEMO_DATA_DIR = "demo_data"
const DEMO_TEMPLATES_DIR = "templates"
const DEMO_AVATARS_DIR = "avatars"
const DEMO_SPACES_DIR = "spaces"
const DEMO_SPACE_FILE_NAME = "space.json"

func main() {
	fsDir := os.Getenv("FILE_STORAGE_DIR")
	if fsDir == "" {
		logger.Panic("No FILE_STORAGE_DIR end variable")
		return
	}
	fs, err := be.NewLocalFileStorage(fsDir)
	if err != nil {
		logger.Panic("Could not open file storage directory: " + fsDir)
		return
	}

	dbInfo, err := db.InitDB()
	if err != nil {
		logger.Panic("DB Initialization Error: " + err.Error())
		return
	}

	err = be.DeleteAllPasswords(dbInfo)
	if err != nil {
		logger.Fatal("Could not delete passwords: ", err)
		return
	}
	err = be.DeleteAllUsers(dbInfo)
	if err != nil {
		logger.Fatal("Could not delete users: ", err)
		return
	}
	err = apiDB.DeleteAllTemplateRecords(fs, dbInfo)
	if err != nil {
		logger.Fatal("Could not delete template records: ", err)
		return
	}
	err = apiDB.DeleteAllSpaceRecords(dbInfo)
	if err != nil {
		logger.Fatal("Could not delete space records: ", err)
		return
	}
	err = apiDB.DeleteAllAvatarPartRecords(dbInfo)
	if err != nil {
		logger.Fatal("Could not avatar part records: ", err)
		return
	}
	err = apiDB.DeleteAllAvatarRecords(dbInfo)
	if err != nil {
		logger.Fatal("Could not avatar records: ", err)
		return
	}

	createUser("alice@example.com", "Alice", "Smith", true, "1234", dbInfo)
	createUser("bob@example.com", "Bob", "Garvey", false, "1234", dbInfo)

	templatesDir := path.Join(DEMO_DATA_DIR, DEMO_TEMPLATES_DIR)
	templatesFileInfos, err := ioutil.ReadDir(templatesDir)
	if err != nil {
		logger.Fatal("Could not read templates dir %s: %s", templatesDir, err)
		return
	}
	for _, info := range templatesFileInfos {
		createTemplate(path.Join(templatesDir, info.Name()), info.Name(), dbInfo, fs)
	}

	avatarsDir := path.Join(DEMO_DATA_DIR, DEMO_AVATARS_DIR)
	avatarsFileInfos, err := ioutil.ReadDir(avatarsDir)
	if err != nil {
		logger.Fatal("Could not read avatars dir %s: %s", avatarsDir, err)
		return
	}
	for _, info := range avatarsFileInfos {
		_, err = createAvatar(path.Join(avatarsDir, info.Name()), dbInfo)
		if err != nil {
			logger.Fatal("Could not create an avatar %s: %s", info.Name, err)
			return
		}
	}

	avatarRecord, err := apiDB.FindDefaultAvatarRecord(dbInfo)
	if err != nil {
		logger.Fatal("Could not find default avatar: %s", err)
		return
	}

	spacesDir := path.Join(DEMO_DATA_DIR, DEMO_SPACES_DIR)
	spacesFileInfos, err := ioutil.ReadDir(spacesDir)
	if err != nil {
		logger.Fatal("Could not read spaces dir %s: %s", spacesDir, err)
		return
	}
	for _, info := range spacesFileInfos {
		createSpace(path.Join(spacesDir, info.Name()), info.Name(), avatarRecord.UUID, dbInfo)
	}
}

func createAvatar(descriptorPath string, dbInfo *be.DBInfo) (*apiDB.AvatarRecord, error) {
	file, err := os.Open(descriptorPath)
	if err != nil {
		return nil, err
	}
	descriptor, err := apiDB.DecodeAvatarDescriptor(file)
	if err != nil {
		return nil, err
	}
	avatarRecord, err := apiDB.CreateAvatarRecord(descriptor.Name, dbInfo)
	if err != nil {
		return nil, err
	}
	for _, partDescriptor := range descriptor.Parts {
		template, err := apiDB.FindTemplateRecordByField("name", partDescriptor.TemplateName, dbInfo)
		if err != nil {
			return nil, err
		}
		template.Part = partDescriptor.Part
		template.Parent = partDescriptor.Parent
		err = apiDB.UpdateTemplateRecord(template, dbInfo)
		if err != nil {
			return nil, err
		}
		partRecord, err := apiDB.CreateAvatarPartRecord(avatarRecord.Id, template.Id, partDescriptor.Name, partDescriptor.Part, partDescriptor.Parent, "", "", "", dbInfo)
		if err != nil {
			return nil, err
		}
		if len(partDescriptor.Position) == 3 {
			partRecord.SetPosition(partDescriptor.Position[0], partDescriptor.Position[1], partDescriptor.Position[2])
		}
		if len(partDescriptor.Orientation) == 4 {
			partRecord.SetOrientation(partDescriptor.Orientation[0], partDescriptor.Orientation[1], partDescriptor.Orientation[2], partDescriptor.Orientation[3])
		}
		if len(partDescriptor.Scale) == 3 {
			partRecord.SetScale(partDescriptor.Scale[0], partDescriptor.Scale[1], partDescriptor.Scale[2])
		}
		_, err = dbInfo.Map.Update(partRecord)
		if err != nil {
			return nil, err
		}
	}
	logger.Println("Created avatar:", descriptor.Name+":", avatarRecord.UUID)
	return avatarRecord, nil
}

func createSpace(directory string, name string, avatarUUID string, dbInfo *be.DBInfo) (*apiDB.SpaceRecord, error) {
	spaceFilePath := path.Join(directory, DEMO_SPACE_FILE_NAME)
	file, err := os.Open(spaceFilePath)
	if err != nil {
		logger.Fatal("Could not open space file", err)
		return nil, err
	}
	defer func() {
		file.Close()
	}()
	state, err := apiDB.DecodeSpaceStateNode(file)
	if err != nil {
		logger.Fatal("Could not parse space file: "+spaceFilePath+": ", err)
		return nil, err
	}
	if err != nil {
		logger.Fatal("Could not read JSON from space file", err)
		return nil, err
	}
	buff := bytes.NewBufferString("")
	state.Encode(buff)

	record, err := apiDB.CreateSpaceRecord(name, buff.String(), avatarUUID, dbInfo)
	if err != nil {
		logger.Fatal("Could not create space record", err)
		return nil, err
	}
	logger.Println("Created space", name+":", record.UUID)
	return record, nil
}

func createTemplate(directory string, name string, dbInfo *be.DBInfo, fs *be.LocalFileStorage) (*apiDB.TemplateRecord, error) {
	dataFileInfos, err := ioutil.ReadDir(directory)
	if err != nil {
		logger.Fatal("Could not read a template dir %s: %s", directory, err)
		return nil, err
	}

	// Find a glTF or obj source file
	var sourceInfo os.FileInfo
	for _, dataInfo := range dataFileInfos {
		if dataInfo.Name() == name+".gltf" {
			sourceInfo = dataInfo
			break
		}
		if dataInfo.Name() == name+".obj" {
			sourceInfo = dataInfo
			break
		}
	}
	if sourceInfo == nil {
		logger.Fatal("Could not find a source file for name")
		return nil, nil
	}

	template, err := apiDB.CreateTemplateRecord(name, sourceInfo.Name(), "", "", dbInfo)
	logger.Printf("Creating template: %s: %s", name, template.UUID)
	if err != nil {
		logger.Fatal("Could not create a template: ", err)
		return nil, err
	}

	for _, dataInfo := range dataFileInfos {
		logger.Printf("\t\tData %s", dataInfo.Name())

		dataPath := path.Join(directory, dataInfo.Name())
		dataFile, err := os.Open(dataPath)
		if err != nil {
			logger.Fatal("Could not open a data file %s:", err)
			return nil, err
		}

		key, err := fs.Put(dataInfo.Name(), dataFile)
		if err != nil {
			logger.Fatal("Store a data file %s:", err)
			return nil, err
		}

		_, err = apiDB.CreateTemplateDataRecord(template.Id, dataInfo.Name(), key, dbInfo)
		if err != nil {
			logger.Fatal("Could not create a template data record %s:", err)
			return nil, err
		}
	}
	return template, nil
}

func createUser(email string, firstName string, lastName string, staff bool, password string, dbInfo *be.DBInfo) (*be.User, error) {
	user, err := be.CreateUser(email, firstName, lastName, staff, dbInfo)
	if err != nil {
		logger.Fatal("Could not create user", err)
		return nil, err
	}
	_, err = be.CreatePassword(password, user.Id, dbInfo)
	if err != nil {
		logger.Fatal("Could not create password", err)
		return nil, err
	}
	return user, nil
}
