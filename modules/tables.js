const express = require('express')
const router = express.Router();
const { query } = require('../utils/database')
const logger = require('../utils/logger')
const multer = require('multer')
const path = require("path")
const fs = require("fs")
var SHA1 = require("crypto-js/sha1");
const ejs = require("ejs")
const nodemailer = require("nodemailer")
const passwdRegExp = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;

var transporter = nodemailer.createTransport({

    host: process.env.SMTP_HOST,

    port: process.env.SMTP_PORT,

    auth: {

        user: process.env.SMTP_USER,

        pass: process.env.SMTP_PASS

    }

});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        const ext = path.extname(file.originalname)
        cb(null, file.fieldname + '-' + uniqueSuffix + ext)
    }
})

const upload = multer({ storage: storage })

// Select all from: table
router.get('/:table', (req, res) => {
    const table = req.params.table;
    query(`SELECT * FROM ${table}`, [], (error, results) => {
        if (error) throw res.status(500).json({ error: error.message });
        res.status(200).json(results)
    }, req);
})

// Select one record from table by : id
router.get('/:table/:id', (req, res) => {
    const table = req.params.table;
    const id = req.params.id
    query(`SELECT * FROM ${table} WHERE id=?`, [id], (error, results) => {
        if (error) throw res.status(500).json({ error: error.message });
        res.status(200).json(results)
    }, req);
})

//SELECT RECORDS FROM TABLE by field
router.get('/:table/:field/:op/:value', (req, res) => {
    let table = req.params.table;
    let field = req.params.field;
    let op = getOP(req.params.op)
    let value = req.params.value;
    if (req.params.op == 'lk') {
        value = `%${value}%`;
    }
    query(`SELECT * FROM ${table} WHERE ${field}${op}?`, [value], (error, results) => {
        if (error) throw res.status(500).json({ error: error.message });
        res.status(200).json(results)
    }, req);
})
// EMAIL KÜLDÉS
router.post(`/sendmail`, async (req,res)=>{
    const {to,subject,template,data} = req.body
    if(!to || !subject || !template){
        return res.status(400).send({error: "Hiányzó adatok!"})
    }
    try{
        await  transporter.sendMail({
            from: process.env.ADMINMAIL,
            to: to,
            subject: subject,
            html: await RenderTemplate(template,data || {})
        })
        return res.status(200).send({message: "Email sikeresen elküldve!"})
    }
    catch(err){
        console.log(err)
        return res.status(500).send({error: "Hiba történt az email küldése során!" + err})
    }
})
// Fájl feltöltés
router.post('/upload', upload.single("image"), (req, res) => {
    if (!req.file) {
        return res.status(500).json({ error: "Nincs fájl feltöltve!" });
    }
    res.status(200).json({ message: "Sikeres feltöltés!", filename: req.file.filename, path: "/uploads" })
})

//LOGIN
router.post('/:table/login', (req, res) => {
    let { email, password } = req.body;
    let table = req.params.table
    //TODO: VALIDÁCIÓ

    if (!email || !password) {
        res.status(404).send({ error: 'Hiányzó adatok!' })
        return;
    }

    query(`SELECT * FROM ${table} WHERE email=? AND password = ?`, [email, SHA1(password).toString()], (error, results) => {
        if (error) throw res.status(500).json({ error: error.message });
        if (results.length == 0) {
            res.status(400).send({ error: 'Hibás belépési adatok!' })
            return;
        }
        if (results[0].status == 0) {
            res.status(400).send({ error: 'Inaktívált felhasználó!' })
        }
        res.status(200).json(results)
    }, req);
})

//REGISTTRATION
router.post('/:table/registration', (req, res) => {
    let table = req.params.table;
    let { name, email, password, confirm } = req.body;
    //TODO: VALIDÁCIÓ

    if (!name || !email || !password || !confirm) {
        res.status(400).send({ error: 'Hiányzó adatok!' });
        return;
    }

    if (password != confirm) {
        res.status(400).send({ error: 'A két jelszó nem egyezik!' });
        return
    }

    if (!password.match(passwdRegExp)) {
        res.status(400).send({ error: 'A jelszó nem elég biztonságos' });
        return
    }

    query(`SELECT id FROM ${table} WHERE email=?`, [email], (error, results) => {
        if (error) return res.status(500).json({ error: error.message });
        if (results.length != 0) {
            res.status(400).send({ error: 'A megadott email cím már regisztrálva van' });
            return
        }

        query(`INSERT INTO ${table} (name, email, password) VALUES (?,?,?)`, [name, email, SHA1(password).toString()], (error, results) => {
            if (error) throw res.status(500).json({ error: error.message });
            res.status(200).json(results)
        }, req);

    }, req)
})

// Add new record to table
router.post('/:table', (req, res) => {
    console.log(req.body)
    let table = req.params.table;
    let fields = Object.keys(req.body).join(',');
    let values = "'" + Object.values(req.body).join("','") + "'";
    query(`INSERT INTO ${table} (${fields}) VALUES (${values})`, [], (error, results) => {
        if (error) throw res.status(500).json({ error: error.message });
        res.status(200).json(results)
    }, req);
})

// Update records in table
router.patch('/:table/:id', (req, res) => {
    let table = req.params.table;
    let id = req.params.id;
    let fields = Object.keys(req.body);
    let values = Object.values(req.body)

    let updates = [];
    for (let i = 0; i < fields.length; i++) {
        updates.push(`${fields[i]} = '${values[i]}'`)
    }
    let str = updates.join(',');

    query(`UPDATE ${table} SET ${str} WHERE id=?`, [id], (error, results) => {
        if (error) throw res.status(500).json({ error: error.message });
        res.status(200).json(results)
    }, req);
})

// DELETE one record from table by : id
router.get('/:table/:id', (req, res) => {
    const table = req.params.table;
    const id = req.params.id
    query(`DELETE * FROM ${table} WHERE id=?`, [id], (error, results) => {
        if (error) throw res.status(500).json({ error: error.message });
        res.status(200).json(results)
    }, req);
})

//DELETE uploaded file
router.delete('/image/:filename', (req, res) => {
    let filename = req.params.filename
    let pathname = path.join(__dirname, '../uploads/')

    fs.unlink(pathname + filename, (err) => {
        if (err) {
            return res.status(500).json({ error: 'A fájl törlése sikertelen' })
        }
        return res.status(200).json({ message: 'A kép törölve!' })
    })
})




function getOP(op) {
    switch (op) {
        case 'eq': {
            op = '=';
            break;
        }
        case 'lt': {
            op = '<';
            break;
        }
        case 'lte': {
            op = '<=';
            break;
        }
        case 'gt': {
            op = '>';
            break;
        }
        case 'gte': {
            op = '>=';
            break;
        }
        case 'not': {
            op = '<>';
            break;
        }
        case 'lk': {
            op = ' like ';
            break;
        }
    }
    return op;
}
async function RenderTemplate(templateName,data){
    const tmpFile = path.join(__dirname, '..' , "templates",templateName+".ejs")
    return await ejs.renderFile(tmpFile, data)
}

module.exports = router;