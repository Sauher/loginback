const express = require("express")
const router = express.Router()
const {query} = require('../utils/database')

// SELECT all records from table
router.get('/:table', (req,res) => {
  const table = req.params.table
    query(`SELECT * FROM ${table}`,[], (error, results) => {
        if (error) return res.status(500).json({error: error.message})
        res.status(200).json(results)
      },req);
    })
// SELECT one record from table BY id
    router.get('/:table/:id', (req,res) => {
      const table = req.params.table
      const id = req.params.id
        query(`SELECT * FROM ${table} WHERE id = ${id}`,[id], (error, results) => {
            if (error) return res.status(500).json({error: error.message})
            res.status(200).json(results)
          },req);
        })
// DELETE one record from table BY id
router.delete('/:table/:id', (req,res) => {
  const table = req.params.table
  const id = req.params.id
    query(`DELETE FROM ${table} WHERE id = ${id}`,[id], (error, results) => {
        if (error) return res.status(500).json({error: error.message})
        res.status(200).json(results)
      },req);
    })


module.exports = router