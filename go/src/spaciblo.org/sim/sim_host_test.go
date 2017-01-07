package sim

import (
	"flag"
	"os"
	"strconv"
	"testing"
	"time"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
	"spaciblo.org/db"
	"spaciblo.org/ws"

	. "github.com/chai2010/assert"
)

var (
	CWD = flag.String("cwd", "", "set cwd") // Sets the current working directory because otherwise the testing CWD is wherever go test puts the test binary
)

func init() {
	flag.Parse()
	if *CWD != "" {
		if err := os.Chdir(*CWD); err != nil {
			logger.Println("Chdir error", err)
		}
	}
}

func TestHostStartup(t *testing.T) {
	err := be.CreateDB()
	AssertNil(t, err)
	dbInfo, err := db.InitDB()
	AssertNil(t, err)
	defer func() {
		be.WipeDB(dbInfo)
		dbInfo.Connection.Close()
	}()

	avatarRecord, err := apiDB.CreateAvatarRecord("Avatar", dbInfo)
	AssertNil(t, err)
	templateRecord0, err := apiDB.CreateTemplateRecord("Template 0", "bogus0.obj", "", "", dbInfo)
	AssertNil(t, err)
	templateRecord1, err := apiDB.CreateTemplateRecord("Template 1", "bogus1.obj", "", "", dbInfo)
	AssertNil(t, err)

	// Create a space for our test
	position := []float64{0, 0, 0}
	orientation := []float64{0, 0, 0, 1}
	rootNode := apiDB.NewSpaceStateNode(position, orientation, templateRecord0.UUID)
	groupNode := apiDB.NewSpaceStateNode(position, orientation, "")
	rootNode.Nodes = append(rootNode.Nodes, *groupNode)
	groupNode.Nodes = append(groupNode.Nodes, *apiDB.NewSpaceStateNode(position, orientation, templateRecord1.UUID))
	_, err = apiDB.CreateSpaceRecord("Space 0", rootNode.ToString(), avatarRecord.UUID, dbInfo)
	AssertNil(t, err)

	wsService, simService, err := createTestCluster(dbInfo)
	AssertNil(t, err)
	defer func() {
		wsService.Stop()
		simService.Stop()
	}()
	wsService.Start()
	simService.Start()
	time.Sleep(time.Millisecond * 2000)

	simClient := NewSimRPCClient(wsService.SimHost)
	err = simClient.Connect()
	AssertNil(t, err)
	defer func() {
		simClient.Close()
	}()

	_, err = simClient.Ping()
	AssertNil(t, err)
	// TODO Actually bang on the test cluster space
}

func createTestCluster(dbInfo *be.DBInfo) (*ws.WSService, *SimHostService, error) {
	var simRPCPort int64 = 7051
	var simHost string = "127.0.0.1:" + strconv.FormatInt(simRPCPort, 10)
	var wsHTTPPort int64 = 7052
	var wsRPCPort int64 = 7053
	var wsRPCHost string = "127.0.0.1:" + strconv.FormatInt(wsRPCPort, 10)

	wsService, err := ws.NewWSService(wsHTTPPort, simHost, wsRPCPort, "test_certs/mycert1.cer", "test_certs/mycert1.key")
	if err != nil {
		return nil, nil, err
	}

	simService, err := NewSimHostService(simRPCPort, wsRPCHost, dbInfo)
	if err != nil {
		return nil, nil, err
	}

	return wsService, simService, nil
}
